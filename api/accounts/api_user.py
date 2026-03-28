from ninja import Router, Schema, File, Form
from ninja.files import UploadedFile
from django.utils import timezone
from accounts.schema import CurrentKeyResponse, WorkspaceMeResponse, UserResponse, WorkspaceResponse, LogoutResponse, TestPassphraseRequest, TestPassphraseResponse, UserFlags, UpdateProfileRequest
from accounts.types import Request
from connection.crypto import decrypt_with_private_key
from connection.key_service import KeyLifecycleService
from accounts.storage import (
    allowed_image_content_type,
    cleanup_internal_image_url,
    store_processed_image,
)


class NotifiedResponse(Schema):
    success: bool


api_user = Router()


@api_user.get("/me", response=WorkspaceMeResponse)
def me(request: Request):
    """Get current user info for workspace-authenticated sessions."""
    session = request.auth
    user = session.user
    workspace = session.workspace

    workspace_response = WorkspaceResponse(
        id=str(workspace.id),
        name=workspace.name,
        slug=workspace.slug,
        role=session.role,
        mode=workspace.mode,
        image_url=workspace.image_url,
    )

    # Calculate flags
    is_solo_admin = KeyLifecycleService.is_solo_admin(workspace, user)
    needs_key_create = False
    needs_key_approval = False
    key_response = None

    if workspace.mode == "vault":
        # Get the current key (latest confirmed, non-revoked)
        # From this single value we can derive all key states:
        # - key is None → needs_key_create
        # - key.approved_at is None → needs_key_approval  
        # - key.approved_at is set → active key ready for use
        current_key = KeyLifecycleService.get_current_key(workspace, user)
        
        if current_key:
            key_response = CurrentKeyResponse(
                id=str(current_key.id),
                passphrase_hint=current_key.passphrase_hint,
                created_at=current_key.created_at.isoformat(),
                confirmed_at=current_key.confirmed_at.isoformat(),
                approved_at=current_key.approved_at.isoformat() if current_key.approved_at else None,
            )
            if not current_key.approved_at:
                needs_key_approval = True
        else:
            needs_key_create = True

    return WorkspaceMeResponse(
        session_type="workspace",
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            image_url=user.identity.image_url,
        ),
        workspace=workspace_response,
        workspaces=[workspace_response],  # V1: Single workspace
        flags=UserFlags(
            is_solo_admin=is_solo_admin,
            needs_key_create=needs_key_create,
            needs_key_approval=needs_key_approval,
        ),
        key=key_response,
    )


@api_user.patch("/me", response=WorkspaceMeResponse)
def update_profile(request: Request, data: UpdateProfileRequest):
    """Update current user's profile (name)."""
    identity = request.auth.user.identity
    if data.name is not None:
        identity.name = data.name.strip()
        identity.save(update_fields=["name"])
    return me(request)


@api_user.post("/logout", response=LogoutResponse)
def logout(request: Request):
    session = request.auth
    session.delete()
    return LogoutResponse(success=True)


@api_user.post("/test-passphrase", response=TestPassphraseResponse)
def test_passphrase(request: Request, data: TestPassphraseRequest):
    """Test if the provided passphrase is correct for the user's key.
    
    SECURITY: This endpoint NEVER logs or stores the passphrase.
    It only tests if the passphrase can decrypt a sample payload.
    
    Tests the active key if available, otherwise falls back to pending key
    (to allow passphrase testing while awaiting admin approval).
    """
    session = request.auth
    user = session.user
    workspace = session.workspace
    
    # Try to get active key first, fall back to pending key
    user_key = KeyLifecycleService.get_active_key(workspace, user)
    if not user_key:
        user_key = KeyLifecycleService.get_pending_key(workspace, user)
    
    # If no key exists, return failure
    if not user_key:
        return TestPassphraseResponse(success=False)
    
    # If sample_payload not set, return failure (legacy keys)
    if not user_key.sample_payload or not user_key.sample_nonce:
        return TestPassphraseResponse(success=False)
    
    try:
        # SECURITY: Attempt to decrypt the sample payload with the provided passphrase
        # If passphrase is correct, this will decrypt to "hello"
        decrypted_text = decrypt_with_private_key(
            user_key.sample_payload,
            user_key.sample_nonce,
            user_key.private_key,
            data.passphrase  # SECURITY: Never log or store this value
        )
        
        # Check if decryption succeeded and matches expected value
        success = (decrypted_text == "hello")
        return TestPassphraseResponse(success=success)
        
    except Exception:
        # SECURITY: Catch all exceptions without logging details
        # Don't reveal why the test failed (timing-safe)
        return TestPassphraseResponse(success=False)


@api_user.post("/notified", response=NotifiedResponse)
def mark_notifications_read(request: Request):
    """Mark all notifications as read by updating notification_read_at timestamp."""
    user = request.auth.user
    user.notification_read_at = timezone.now()
    user.save(update_fields=["notification_read_at"])
    return NotifiedResponse(success=True)


class AvatarUploadResponse(Schema):
    success: bool
    image_url: str


@api_user.post("/avatar", response=AvatarUploadResponse)
def upload_avatar(request: Request, file: UploadedFile = File(...)):
    """Upload profile picture. Processes image and stores with provider abstraction.
    
    Accepts: JPEG, PNG, WebP, GIF
    Returns: Public URL to the uploaded image
    """
    identity = request.auth.user.identity
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if not allowed_image_content_type(file.content_type):
        from vaultsql.api_policies import BadRequest
        raise BadRequest(f"Invalid file type. Allowed: {', '.join(allowed_types)}")
    
    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if file.size > max_size:
        from vaultsql.api_policies import BadRequest
        raise BadRequest("File size must be less than 10MB")
    
    try:
        previous_image_url = identity.image_url
        image_url = store_processed_image(file)

        identity.image_url = image_url
        identity.save(update_fields=["image_url"])

        cleanup_internal_image_url(previous_image_url)

        return AvatarUploadResponse(success=True, image_url=image_url)
        
    except ValueError as e:
        from vaultsql.api_policies import BadRequest
        raise BadRequest(str(e))
    except Exception as e:
        from vaultsql.api_policies import BadRequest
        raise BadRequest(f"Failed to upload image: {str(e)}")
