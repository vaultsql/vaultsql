import secrets
from datetime import timedelta
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from ninja import Router
from notifications.email.renderer import load_email_html
from notifications.email.send import send_email

from accounts.models import Identity, LoginCode, Session, SocialAccount, SocialProvider, User, get_gravatar_url
from accounts.storage import download_and_upload_profile_image
from accounts.schema import (
    GoogleAuthCompleteRequest,
    GoogleAuthStartResponse,
    IdentityAuthResponse,
    IdentityResponse,
    LoginRequest,
    RequestLoginCodeRequest,
    SignupRequest,
    VerifyLoginCodeRequest,
)
from accounts.types import Request
from vaultsql.api_policies import BadRequest, NotFound, Unauthorized


api_auth = Router()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_STATE_SALT = "vaultsql.google.oauth"
GOOGLE_STATE_MAX_AGE = 10 * 60


def _google_redirect_uris() -> list[str]:
    redirect_uris = getattr(settings, "GOOGLE_OAUTH_REDIRECT_URIS", [])
    return [uri.rstrip("/") for uri in redirect_uris if uri]


def _validate_google_redirect_uri(redirect_uri: str) -> str:
    if not redirect_uri:
        raise BadRequest("Redirect URI is required")
    normalized = redirect_uri.rstrip("/")
    if normalized not in _google_redirect_uris():
        raise BadRequest("Invalid redirect URI")
    return normalized


def _build_google_state(redirect_uri: str) -> str:
    payload = {
        "nonce": secrets.token_urlsafe(16),
        "redirect_uri": redirect_uri,
    }
    return signing.dumps(payload, salt=GOOGLE_STATE_SALT, compress=True)


def _load_google_state(state: str) -> dict:
    try:
        payload = signing.loads(state, salt=GOOGLE_STATE_SALT, max_age=GOOGLE_STATE_MAX_AGE)
    except signing.BadSignature:
        raise BadRequest("Invalid or expired OAuth state")
    redirect_uri = payload.get("redirect_uri")
    if not redirect_uri or redirect_uri.rstrip("/") not in _google_redirect_uris():
        raise BadRequest("Invalid OAuth state")
    return payload


def _get_google_client_credentials() -> tuple[str, str]:
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
    client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", None)
    if not client_id or not client_secret:
        raise BadRequest("Google OAuth is not configured")
    return client_id, client_secret


@api_auth.post("/signup", response=IdentityAuthResponse)
def signup(request: Request, data: SignupRequest):
    # Check if identity already exists
    if Identity.objects.filter(email=data.email).exists():
        raise BadRequest("User with this email already exists")

    # Create identity with hashed password and Gravatar as default image
    identity = Identity.objects.create(
        email=data.email,
        name=data.name,
        image_url=get_gravatar_url(data.email),
    )
    identity.set_password(data.password)
    identity.save()

    # Create identity-only session
    token = secrets.token_urlsafe(48)
    Session.objects.create(
        identity=identity,
        token=token,
        expiry=timezone.now() + timedelta(days=30),
    )

    return IdentityAuthResponse(
        token=token,
        identity=IdentityResponse(
            id=str(identity.id),
            email=identity.email,
            name=identity.name,
        ),
        needs_onboarding=True,
    )


@api_auth.post("/login", response=IdentityAuthResponse)
def login(request: Request, data: LoginRequest):
    """Login and create session.

    Returns IdentityAuthResponse with needs_onboarding flag.
    """
    # First, verify identity credentials
    try:
        identity = Identity.objects.get(email=data.email)
    except Identity.DoesNotExist:
        raise Unauthorized("Invalid credentials")

    if not identity.check_password(data.password):
        raise Unauthorized("Invalid credentials")

    # Try to find an active user for this identity
    users = (
        User.objects.select_related("identity", "workspace")
        .filter(
            identity=identity,
            is_active=True,
            deactivated_at__isnull=True,
            workspace__is_active=True,
        )
        .order_by("date_joined")
    )

    user = users.first()
    token = secrets.token_urlsafe(48)
    needs_onboarding = user is None

    if user:
        # Create workspace session
        Session.objects.create(
            identity=identity,
            user=user,
            workspace=user.workspace,
            role=user.role,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )
    else:
        # Create identity-only session
        Session.objects.create(
            identity=identity,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )

    return IdentityAuthResponse(
        token=token,
        identity=IdentityResponse(
            id=str(identity.id),
            email=identity.email,
            name=identity.name,
        ),
        needs_onboarding=needs_onboarding,
    )


@api_auth.post("/devlogin", response=IdentityAuthResponse)
def devlogin_default(request: Request):
    """Development-only login endpoint that logs in as the configured dev identity.

    This endpoint only works when DEBUG mode is enabled.
    """
    # Check if DEBUG mode is enabled
    if not settings.DEBUG:
        raise BadRequest("This endpoint is only available in debug mode")

    # Look up the identity
    try:
        identity = Identity.objects.get(email=settings.DEV_LOGIN_EMAIL)
    except Identity.DoesNotExist:
        raise NotFound("Dev user not found")

    # Try to find an active user for this identity
    users = (
        User.objects.select_related("identity", "workspace")
        .filter(
            identity=identity,
            is_active=True,
            deactivated_at__isnull=True,
            workspace__is_active=True,
        )
        .order_by("date_joined")
    )

    user = users.first()
    token = secrets.token_urlsafe(48)
    needs_onboarding = user is None

    if user:
        # Create workspace session
        Session.objects.create(
            identity=identity,
            user=user,
            workspace=user.workspace,
            role=user.role,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )
    else:
        # Create identity-only session
        Session.objects.create(
            identity=identity,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )

    return IdentityAuthResponse(
        token=token,
        identity=IdentityResponse(
            id=str(identity.id),
            email=identity.email,
            name=identity.name,
        ),
        needs_onboarding=needs_onboarding,
    )


@api_auth.post("/devlogin/{user}", response=IdentityAuthResponse)
def devlogin_user(request: Request, user: str):
    """Development-only login endpoint that logs in as a suffixed dev identity.

    Auto-creates the identity if it doesn't exist (useful for Playwright tests).
    This endpoint only works when DEBUG mode is enabled.
    """
    # Check if DEBUG mode is enabled
    if not settings.DEBUG:
        raise BadRequest("This endpoint is only available in debug mode")

    # Enforce the configured dev email format localpart+{user}@domain
    email = f"{settings.DEV_LOGIN_EMAIL_LOCALPART}+{user}@{settings.DEV_LOGIN_EMAIL_DOMAIN}"

    # Get or create the identity
    identity, created = Identity.objects.get_or_create(
        email=email,
        defaults={
            'name': f"{user.capitalize()} Test",
            'image_url': get_gravatar_url(email),
        }
    )

    # If created, set a random password (for backwards compatibility)
    if created:
        identity.set_password(secrets.token_urlsafe(32))
        identity.save()
    
    # Try to find an active user for this identity
    users = (
        User.objects.select_related("identity", "workspace")
        .filter(
            identity=identity,
            is_active=True,
            deactivated_at__isnull=True,
            workspace__is_active=True,
        )
        .order_by("date_joined")
    )
    
    user = users.first()
    token = secrets.token_urlsafe(48)
    needs_onboarding = user is None
    
    if user:
        # Create workspace session
        Session.objects.create(
            identity=identity,
            user=user,
            workspace=user.workspace,
            role=user.role,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )
    else:
        # Create identity-only session
        Session.objects.create(
            identity=identity,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )
    
    return IdentityAuthResponse(
        token=token,
        identity=IdentityResponse(
            id=str(identity.id),
            email=identity.email,
            name=identity.name,
        ),
        needs_onboarding=needs_onboarding,
    )


@api_auth.post("/request-code")
def request_login_code(request: Request, data: RequestLoginCodeRequest):
    """Request a login code to be sent to email.

    Sends a 6-digit code to the provided email address.
    Does not reveal whether the email exists in the system.
    """
    email = data.email.lower()

    # Rate limiting: max 3 codes per email per 10 minutes
    ten_minutes_ago = timezone.now() - timedelta(minutes=10)
    recent_codes = LoginCode.objects.filter(
        email=email,
        created_at__gte=ten_minutes_ago,
    ).count()

    if recent_codes >= 3:
        raise BadRequest("Too many login attempts. Please try again later.")

    # Get IP from request
    ip_address = request.META.get('REMOTE_ADDR')

    # Generate code
    login_code = LoginCode.generate_login_code(email, ip_address)

    # Load email template and replace variables
    html_content = load_email_html('login-code', {
        'code': login_code.code,
        'email': email,
    })

    text_content = f"""Your VaultSQL login code is: {login_code.code}

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email."""

    # Send email
    try:
        send_email(
            to=email,
            subject="Your VaultSQL login code",
            content_html=html_content,
            content_text=text_content,
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send login code email: {e}", exc_info=True)
        # Continue anyway - don't reveal email sending failure to user

    return {"success": True}


@api_auth.post("/verify-code", response=IdentityAuthResponse)
def verify_login_code(request: Request, data: VerifyLoginCodeRequest):
    """Verify login code and create session.

    Returns session token and identity information.
    """
    email = data.email.lower()
    code = data.code.strip()

    # Find valid code
    try:
        login_code = LoginCode.objects.get(
            email=email,
            code=code,
            verified_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
    except LoginCode.DoesNotExist:
        raise Unauthorized("Invalid or expired code")

    # Mark code as verified
    login_code.mark_verified()

    # Get or create identity
    identity, created = Identity.objects.get_or_create(
        email=email,
        defaults={
            'name': '',
            'image_url': get_gravatar_url(email),
        }
    )

    # If created, set a random password (for backwards compatibility)
    if created:
        identity.set_password(secrets.token_urlsafe(32))
        identity.save()

    # Try to find an active user for this identity
    users = (
        User.objects.select_related("identity", "workspace")
        .filter(
            identity=identity,
            is_active=True,
            deactivated_at__isnull=True,
            workspace__is_active=True,
        )
        .order_by("date_joined")
    )

    user = users.first()
    token = secrets.token_urlsafe(48)
    needs_onboarding = user is None

    if user:
        # Create workspace session
        Session.objects.create(
            identity=identity,
            user=user,
            workspace=user.workspace,
            role=user.role,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )
    else:
        # Create identity-only session
        Session.objects.create(
            identity=identity,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )

    return IdentityAuthResponse(
        token=token,
        identity=IdentityResponse(
            id=str(identity.id),
            email=identity.email,
            name=identity.name,
        ),
        needs_onboarding=needs_onboarding,
    )


@api_auth.get("/google/start", response=GoogleAuthStartResponse)
def google_start(request: Request, redirect_uri: str):
    if not settings.ENABLE_GOOGLE_AUTH:
        raise NotFound("Google authentication is not enabled")
    client_id, _ = _get_google_client_credentials()
    redirect_uri = _validate_google_redirect_uri(redirect_uri)
    state = _build_google_state(redirect_uri)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return GoogleAuthStartResponse(auth_url=auth_url, state=state)


@api_auth.post("/google/complete", response=IdentityAuthResponse)
def google_complete(request: Request, data: GoogleAuthCompleteRequest):
    if not settings.ENABLE_GOOGLE_AUTH:
        raise NotFound("Google authentication is not enabled")
    client_id, client_secret = _get_google_client_credentials()
    state_payload = _load_google_state(data.state)
    redirect_uri = state_payload["redirect_uri"]

    try:
        token_response = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": data.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
    except httpx.RequestError:
        raise BadRequest("Google token exchange failed")

    if token_response.status_code != 200:
        raise BadRequest("Google token exchange failed")

    token_payload = token_response.json()
    access_token = token_payload.get("access_token")
    if not access_token:
        raise BadRequest("Google token exchange failed")

    try:
        userinfo_response = httpx.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except httpx.RequestError:
        raise BadRequest("Google userinfo request failed")

    if userinfo_response.status_code != 200:
        raise BadRequest("Google userinfo request failed")

    userinfo = userinfo_response.json()
    email = userinfo.get("email")
    if not email:
        raise BadRequest("Google account email is missing")
    if userinfo.get("email_verified") is False:
        raise Unauthorized("Google account email is not verified")

    provider_user_id = userinfo.get("sub")
    given_name = userinfo.get("given_name") or ""
    family_name = userinfo.get("family_name") or ""
    full_name = f"{given_name} {family_name}".strip()
    # Google picture URL may be None or empty - always have Gravatar as fallback
    picture_url = userinfo.get("picture") or None

    with transaction.atomic():
        identity, created = Identity.objects.get_or_create(email=email)
        if created:
            identity.set_password(secrets.token_urlsafe(32))
        updated = False
        if full_name and not identity.name:
            identity.name = full_name
            updated = True
        # Set image: download from Google and cache in configured image storage
        if not identity.image_url:
            cached_image_url = None
            if picture_url:
                # Download Google profile image and store in our image backend
                cached_image_url = download_and_upload_profile_image(
                    picture_url, str(identity.id)
                )
            # Fall back to Gravatar if download failed or no picture URL
            identity.image_url = cached_image_url or get_gravatar_url(email)
            updated = True
        if created or updated:
            identity.save()

        users = (
            User.objects.select_related("identity", "workspace")
            .filter(
                identity=identity,
                is_active=True,
                deactivated_at__isnull=True,
                workspace__is_active=True,
            )
            .order_by("date_joined")
        )

        user = users.first()
        token = secrets.token_urlsafe(48)
        needs_onboarding = user is None

        if user:
            Session.objects.create(
                identity=identity,
                user=user,
                workspace=user.workspace,
                role=user.role,
                token=token,
                expiry=timezone.now() + timedelta(days=30),
            )

            if provider_user_id:
                existing_account = SocialAccount.objects.filter(
                    workspace=user.workspace,
                    provider=SocialProvider.GOOGLE.value,
                    provider_user_id=provider_user_id,
                ).first()
                if existing_account and existing_account.user_id != user.id:
                    raise Unauthorized("Google account already linked to another user")

                expires_in = token_payload.get("expires_in")
                expires_at = (
                    timezone.now() + timedelta(seconds=int(expires_in))
                    if expires_in
                    else None
                )
                defaults = {
                    "user": user,
                    "email": email,
                    "access_token": token_payload.get("access_token", ""),
                    "expires_at": expires_at,
                }
                refresh_token = token_payload.get("refresh_token")
                if refresh_token:
                    defaults["refresh_token"] = refresh_token

                SocialAccount.objects.update_or_create(
                    workspace=user.workspace,
                    provider=SocialProvider.GOOGLE.value,
                    provider_user_id=provider_user_id,
                    defaults=defaults,
                )
        else:
            Session.objects.create(
                identity=identity,
                token=token,
                expiry=timezone.now() + timedelta(days=30),
            )

    return IdentityAuthResponse(
        token=token,
        identity=IdentityResponse(
            id=str(identity.id),
            email=identity.email,
            name=identity.name,
        ),
        needs_onboarding=needs_onboarding,
    )
