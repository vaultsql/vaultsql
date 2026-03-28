import secrets
import string
from datetime import timedelta
from ninja import Router, Schema, File, Form
from ninja.files import UploadedFile
from django.utils import timezone

from accounts.schema import WorkspaceInvitationResponse
from accounts.types import Request
from accounts.models import WorkspaceInvitation
from accounts.storage import (
    allowed_image_content_type,
    cleanup_internal_image_url,
    store_processed_image,
)
from vaultsql.api_policies import require_admin, BadRequest


api_workspace = Router()


def _invitation_response(invitation: WorkspaceInvitation) -> WorkspaceInvitationResponse:
    return WorkspaceInvitationResponse(
        id=str(invitation.id),
        token=invitation.token,
        created_at=invitation.created_at.isoformat(),
        revoked_at=invitation.revoked_at.isoformat() if invitation.revoked_at else None,
        expires_at=invitation.expires_at.isoformat() if invitation.expires_at else None,
        max_uses=invitation.max_uses,
        use_count=invitation.use_count,
    )


@api_workspace.post("/invite", response=WorkspaceInvitationResponse)
def create_or_get_invitation(
    request: Request,
    force: bool = False,
    expires_in_days: int | None = None,
    max_uses: int | None = None,
):
    """Create or retrieve workspace invitation token.
    
    Only admins can access this endpoint.
    
    Args:
        force: If True, revokes existing invitation and creates a new one.
               If False, returns existing invitation or creates new if none exists.
        expires_in_days: Number of days until invitation expires (optional).
        max_uses: Maximum number of times this invitation can be used (optional).
    """
    require_admin(request)
    workspace = request.auth.workspace
    user = request.auth.user
    
    # Validate max_uses
    if max_uses is not None and max_uses < 1:
        raise BadRequest("max_uses must be at least 1")
    
    # Find existing non-revoked invitation
    existing = WorkspaceInvitation.objects.filter(
        workspace=workspace,
        revoked_at__isnull=True,
    ).first()
    
    if force and existing:
        # Revoke the existing invitation
        existing.revoked_at = timezone.now()
        existing.save(update_fields=["revoked_at"])
        existing = None
    
    if existing:
        # Return existing invitation
        return _invitation_response(existing)
    
    # Calculate expiration
    expires_at = None
    if expires_in_days is not None:
        if expires_in_days < 1:
            raise BadRequest("expires_in_days must be at least 1")
        expires_at = timezone.now() + timedelta(days=expires_in_days)
    
    # Create new invitation
    token = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(7))
    invitation = WorkspaceInvitation.objects.create(
        workspace=workspace,
        token=token,
        expires_at=expires_at,
        max_uses=max_uses,
        created_by=user,
    )
    
    return _invitation_response(invitation)


class WorkspaceImageResponse(Schema):
    success: bool
    image_url: str


@api_workspace.post("/image", response=WorkspaceImageResponse)
def upload_workspace_image(request: Request, file: UploadedFile = File(...)):
    """Upload workspace image. Processes image and stores with provider abstraction.
    
    Admin only.
    
    Accepts: JPEG, PNG, WebP, GIF
    Returns: Public URL to the uploaded image
    """
    require_admin(request)
    workspace = request.auth.workspace
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if not allowed_image_content_type(file.content_type):
        raise BadRequest(f"Invalid file type. Allowed: {', '.join(allowed_types)}")
    
    # Validate file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if file.size > max_size:
        raise BadRequest("File size must be less than 10MB")
    
    try:
        previous_image_url = workspace.image_url
        image_url = store_processed_image(file)

        workspace.image_url = image_url
        workspace.save(update_fields=["image_url"])

        cleanup_internal_image_url(previous_image_url)

        return WorkspaceImageResponse(success=True, image_url=image_url)
        
    except ValueError as e:
        raise BadRequest(str(e))
    except Exception as e:
        raise BadRequest(f"Failed to upload image: {str(e)}")
