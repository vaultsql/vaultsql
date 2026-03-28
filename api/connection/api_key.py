"""
API endpoints for user key management (vault mode).

Key lifecycle:
1. User generates a keypair with a passphrase
2. Admin approves the key (activates it)
3. User can now access credentials encrypted for their key
4. Admin can revoke the key
"""

import logging
from django.utils import timezone
from ninja import Router, Schema

from accounts.models import WorkspaceRole
from accounts.types import Request
from vaultsql.api_policies import BadRequest, require_admin, require_vault_mode
from connection.models import UserKey
from connection.crypto import generate_passphrase
from connection.policies import get_user_key
from connection.key_service import KeyLifecycleService
from connection.types import (
    CreateKeyResponse,
    UserKeyResponse,
    ActivateKeyRequest,
    RevokeKeyRequest,
    ConfirmKeyRequest,
    SuccessResponse,
)
from notifications.dispatch import notification_dispatch
from notifications.builders import NewKeyNotificationBuilder

logger = logging.getLogger(__name__)


class PassphraseResponse(Schema):
    passphrase: str


api_key = Router()


def notify_admins_of_pending_key(key: UserKey) -> None:
    """Send notification to all admins about a pending key approval.
    
    Args:
        key: The UserKey that needs approval
    """
    # Get all active admins except the requester
    admins = key.workspace.users.filter(
        role=WorkspaceRole.ADMIN.value,
        is_active=True,
        deactivated_at__isnull=True,
    ).exclude(id=key.user_id)
    
    if not admins.exists():
        logger.info(f"No admins to notify for key {key.id}")
        return
    
    # Use notification builder pattern
    builder = NewKeyNotificationBuilder(key)
    
    for admin in admins:
        try:
            notification_dispatch(
                workspace=key.workspace,
                recipient=admin,
                builder=builder,
            )
            logger.info(f"Sent key approval notification to {admin.email}")
        except Exception as e:
            logger.error(f"Failed to send key approval notification to {admin.email}: {e}", exc_info=True)
            # Continue to next admin even if one fails


def _key_response(key: UserKey) -> UserKeyResponse:
    """Build UserKeyResponse from model."""
    return UserKeyResponse(
        id=str(key.id),
        user_id=str(key.user_id),
        user_email=key.user.email,
        passphrase_hint=key.passphrase_hint,
        created_at=key.created_at.isoformat(),
        confirmed_at=key.confirmed_at.isoformat() if key.confirmed_at else None,
        approved_at=key.approved_at.isoformat() if key.approved_at else None,
        revoked_at=key.revoked_at.isoformat() if key.revoked_at else None,
    )


@api_key.get("/me", response=list[UserKeyResponse])
def get_my_keys(request: Request):
    """Get all keys for the current user in the current workspace."""
    keys = UserKey.objects.filter(
        workspace=request.auth.workspace,
        user=request.auth.user,
    ).order_by('-created_at')
    
    return [_key_response(k) for k in keys]


@api_key.get("/pending", response=list[UserKeyResponse])
def list_pending_keys(request: Request):
    """
    List all pending (unapproved) keys in the workspace.
    Admin only.
    """
    require_admin(request)
    
    keys = UserKey.objects.filter(
        workspace=request.auth.workspace,
        approved_at__isnull=True,
        confirmed_at__isnull=False,
        revoked_at__isnull=True,
    ).select_related('user').order_by('-created_at')
    
    return [_key_response(k) for k in keys]


@api_key.get("/all", response=list[UserKeyResponse])
def list_all_keys(request: Request):
    """
    List all keys in the workspace.
    Admin only.
    """
    require_admin(request)
    
    keys = UserKey.objects.filter(
        workspace=request.auth.workspace,
    ).select_related('user').order_by('-created_at')
    
    return [_key_response(k) for k in keys]


@api_key.post("/activate", response=SuccessResponse)
def activate_user_key(request: Request, data: ActivateKeyRequest):
    """
    Approve a user's key so they can access credentials.
    
    Admin must provide their own passphrase to decrypt existing credentials
    and re-encrypt them for the new key. This re-encrypts ALL workspace credentials
    for the newly approved key.
    """
    require_admin(request)
    require_vault_mode(request.auth.workspace, "Key activation only available in vault mode")
    
    key = get_user_key(request, data.key_id)
    
    try:
        KeyLifecycleService.activate_key(
            key=key,
            admin_user=request.auth.user,
            admin_passphrase=data.admin_passphrase,
        )
    except ValueError as e:
        raise BadRequest(str(e))
    
    return SuccessResponse(success=True)


@api_key.post("/revoke", response=SuccessResponse)
def revoke_user_key(request: Request, data: RevokeKeyRequest):
    """
    Revoke a user's key. They will no longer be able to access credentials.
    Admin only.
    """
    require_admin(request)
    
    key = get_user_key(request, data.key_id)
    
    KeyLifecycleService.revoke_key(key)
    
    return SuccessResponse(success=True)


@api_key.post("/confirm", response=SuccessResponse)
def confirm_key(request: Request, data: ConfirmKeyRequest):
    """
    Mark a user's key as confirmed (they saved the passphrase).
    
    This also revokes all other non-revoked keys for the user, since confirming
    a key means committing to use it. This handles both initial key creation and
    key recovery flows identically.
    """
    session = request.auth
    key = get_user_key(request, data.key_id)

    if key.user_id != session.user_id:
        raise BadRequest("Key does not belong to user")

    try:
        needs_approval = KeyLifecycleService.confirm_key(key)
        
        # Notify admins if key needs approval (not auto-approved for solo admin)
        if needs_approval:
            notify_admins_of_pending_key(key)
    except ValueError as e:
        raise BadRequest(str(e))

    return SuccessResponse(success=True)


@api_key.get("/passphrase", response=PassphraseResponse)
def suggest_passphrase(request: Request):
    """
    Generate a suggested passphrase for key creation.
    Returns a 12-word passphrase that the user should store securely.
    """
    return PassphraseResponse(passphrase=generate_passphrase(12))


@api_key.post("/create", response=CreateKeyResponse)
def create_key(request: Request):
    """
    Generate a new keypair for the current user with an auto-generated passphrase.
    
    The passphrase is generated automatically (12 words).
    This is the ONLY time the passphrase is shown to the user.
    
    Keys are created in an unconfirmed state. Old keys are NOT revoked until the user
    confirms they've saved the passphrase (via /confirm endpoint). This allows users
    to abandon the key creation flow without losing access.
    
    Solo admins get auto-confirmed and auto-approved keys since there's no other admin
    to approve them.
    """
    session = request.auth
    workspace = session.workspace
    user = session.user
    
    require_vault_mode(workspace, "Key creation only available in vault mode")

    user_key, passphrase = KeyLifecycleService.create_key(
        workspace=workspace,
        user=user,
    )
    
    return CreateKeyResponse(
        id=str(user_key.id),
        passphrase=passphrase,  # SECURITY: Only shown once!
        passphrase_hint=user_key.passphrase_hint,
        created_at=user_key.created_at.isoformat(),
    )
