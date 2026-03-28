import secrets
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from ninja import Router

from accounts.models import Session, User, Workspace, WorkspaceRole, WorkspaceInvitation, InvitationUsage
from workspace.models import WorkspaceSettings
from accounts.schema import (
    AuthResponse,
    IdentityMeResponse,
    IdentityResponse,
    IdentityWorkspaceResponse,
    JoinWorkspaceRequest,
    WorkspaceCreateRequest,
    WorkspaceResponse,
)
from accounts.types import RequestIdentity
from vaultsql.api_policies import BadRequest, NotFound
from workspace.audit import create_user_audit_log
from workspace.types import AuditEventType
from accounts.loops import create_loops_contact

api_identity = Router()


@api_identity.get("/me", response=IdentityMeResponse)
def me(request: RequestIdentity):
    """Get current identity info and available workspaces."""
    identity = request.auth.identity
    users = (
        User.objects.select_related("workspace")
        .filter(
            identity=identity,
            is_active=True,
            deactivated_at__isnull=True,
            workspace__is_active=True,
        )
        .order_by("workspace__name")
    )

    workspaces = [
        WorkspaceResponse(
            id=str(user.workspace.id),
            name=user.workspace.name,
            slug=user.workspace.slug,
            role=user.role,
            mode=user.workspace.mode,
            image_url=user.workspace.image_url,
        )
        for user in users
    ]

    return IdentityMeResponse(
        session_type="identity",
        identity=IdentityResponse(
            id=str(identity.id),
            email=identity.email,
            name=identity.name,
            image_url=identity.image_url,
        ),
        workspaces=workspaces,
    )


@api_identity.get("/workspace", response=list[IdentityWorkspaceResponse])
def list_workspaces(request: RequestIdentity, join: bool = False, invite_code: str | None = None):
    identity = request.auth.identity
    
    # If invite code provided, only return the invited workspace
    if invite_code:
        try:
            invitation = WorkspaceInvitation.objects.select_related("workspace").get(
                token=invite_code,
                workspace__is_active=True,
            )
            # Validate invitation
            if not invitation.is_valid():
                return []
            
            # Check if user is already a member
            existing_user = User.objects.filter(
                identity=identity,
                workspace=invitation.workspace,
            ).first()
            if existing_user:
                return []
            
            return [
                IdentityWorkspaceResponse(
                    id=str(invitation.workspace.id),
                    name=invitation.workspace.name,
                    slug=invitation.workspace.slug,
                    role=None,
                    mode=invitation.workspace.mode,
                    image_url=invitation.workspace.image_url,
                )
            ]
        except WorkspaceInvitation.DoesNotExist:
            return []
    
    if join:
        # If join=True, check for workspaces with allowed domains
        email_domain = identity.email.split("@")[-1].lower()
        # Use JSONField contains lookup - checks if email_domain is in the array
        workspaces_with_allowed_domain = Workspace.objects.filter(
            is_active=True,
            settings__allowed_email_domains__contains=email_domain,
        ).exclude(
            users__identity=identity
        )
        
        return [
            IdentityWorkspaceResponse(
                id=str(workspace.id),
                name=workspace.name,
                slug=workspace.slug,
                role=None,
                mode=workspace.mode,
                image_url=workspace.image_url,
            )
            for workspace in workspaces_with_allowed_domain
        ]
    
    # Get user's existing workspaces
    users = (
        User.objects.select_related("workspace")
        .filter(
            identity=identity,
            is_active=True,
            deactivated_at__isnull=True,
            workspace__is_active=True,
        )
        .order_by("workspace__name")
    )
    return [
        IdentityWorkspaceResponse(
            id=str(user.workspace.id),
            name=user.workspace.name,
            slug=user.workspace.slug,
            role=user.role,
            mode=user.workspace.mode,
            image_url=user.workspace.image_url,
        )
        for user in users
    ]


@api_identity.post("/workspace", response=AuthResponse)
def create_workspace(request: RequestIdentity, data: WorkspaceCreateRequest):
    """Create a new workspace."""
    identity = request.auth.identity
    
    slug = str(uuid.uuid4())
    while Workspace.objects.filter(slug=slug).exists():
        slug = str(uuid.uuid4())

    with transaction.atomic():
        # Update identity name if provided (allows override)
        if data.user_name:
            identity.name = data.user_name
            identity.save()
        
        workspace = Workspace.objects.create(
            name=data.name, 
            slug=slug,
            mode=data.mode,
            referrer=data.referrer
        )
        user = User.objects.create_user(
            email=identity.email,
            password=None,
            workspace=workspace,
            role=WorkspaceRole.ADMIN.value,
        )

        token = secrets.token_urlsafe(48)
        Session.objects.create(
            identity=identity,
            user=user,
            workspace=workspace,
            role=user.role,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )
        
    # Create Loops contact outside transaction (fire-and-forget)
    create_loops_contact(user, "create_workspace")

    return AuthResponse(token=token)


@api_identity.post("/workspace/{workspace_id}/login", response=AuthResponse)
def login_workspace(request: RequestIdentity, workspace_id: str):
    identity = request.auth.identity
    try:
        user = User.objects.select_related("workspace").get(
            identity=identity,
            workspace_id=workspace_id,
            is_active=True,
            deactivated_at__isnull=True,
            workspace__is_active=True,
        )
    except User.DoesNotExist:
        raise NotFound("Workspace not found")

    token = secrets.token_urlsafe(48)
    Session.objects.create(
        identity=identity,
        user=user,
        workspace=user.workspace,
        role=user.role,
        token=token,
        expiry=timezone.now() + timedelta(days=30),
    )

    return AuthResponse(token=token)


@api_identity.post("/workspace/{workspace_id}/join", response=AuthResponse)
def join_workspace(
    request: RequestIdentity,
    workspace_id: str,
    data: JoinWorkspaceRequest,
    invite_code: str | None = None,
):
    identity = request.auth.identity

    user_name = data.user_name or identity.name or ""
    
    # Get workspace
    try:
        workspace = Workspace.objects.get(id=workspace_id, is_active=True)
    except Workspace.DoesNotExist:
        raise NotFound("Workspace not found")
    
    # Check if user is already a member
    existing_user = User.objects.filter(
        identity=identity,
        workspace=workspace,
    ).first()
    if existing_user:
        raise BadRequest("You are already a member of this workspace")
    
    # Check if email domain is allowed (if no invite code provided)
    if not invite_code:
        settings, _ = WorkspaceSettings.objects.get_or_create(workspace=workspace)
        allowed_domains = settings.allowed_email_domains or []
        if allowed_domains:
            email_domain = identity.email.split("@")[-1].lower()
            if email_domain in allowed_domains:
                # Auto-join via allowed domain
                with transaction.atomic():
                    # Update identity name if provided (allows override)
                    if user_name:
                        identity.name = user_name
                        identity.save()
                    
                    user = User.objects.create_user(
                        email=identity.email,
                        password=None,
                        workspace=workspace,
                        role=WorkspaceRole.MEMBER.value,
                    )
                    
                    token = secrets.token_urlsafe(48)
                    Session.objects.create(
                        identity=identity,
                        user=user,
                        workspace=workspace,
                        role=user.role,
                        token=token,
                        expiry=timezone.now() + timedelta(days=30),
                    )
                    
                    create_user_audit_log(
                        workspace=workspace,
                        user=user,
                        event_type=AuditEventType.USER_JOINED,
                        metadata={"method": "allowed_domain", "domain": email_domain},
                    )
                
                # Create Loops contact outside transaction (fire-and-forget)
                create_loops_contact(user, "join_workspace")
                
                return AuthResponse(token=token)
        else:
            raise BadRequest("Invite code is required to join this workspace")
    
    # Verify the invite code is valid for this workspace
    try:
        invitation = WorkspaceInvitation.objects.select_related("workspace").get(
            token=invite_code,
            workspace_id=workspace_id,
            workspace__is_active=True,
        )
    except WorkspaceInvitation.DoesNotExist:
        raise BadRequest("Invalid or expired invite code")
    
    # Validate invitation
    if not invitation.is_valid():
        if invitation.revoked_at:
            raise BadRequest("This invitation has been revoked")
        if invitation.expires_at and invitation.expires_at < timezone.now():
            raise BadRequest("This invitation has expired")
        if invitation.max_uses is not None and invitation.use_count >= invitation.max_uses:
            raise BadRequest("This invitation has reached its usage limit")
        raise BadRequest("Invalid or expired invite code")
    
    with transaction.atomic():
        # Update identity name if provided (allows override)
        if user_name:
            identity.name = user_name
            identity.save()
        
        # Create user in the workspace
        user = User.objects.create_user(
            email=identity.email,
            password=None,
            workspace=invitation.workspace,
            role=WorkspaceRole.MEMBER.value,
        )
        
        # Increment invitation use count
        invitation.use_count += 1
        invitation.save(update_fields=["use_count"])
        
        # Record invitation usage
        InvitationUsage.objects.create(
            invitation=invitation,
            user=user,
        )
        
        # Create session
        token = secrets.token_urlsafe(48)
        Session.objects.create(
            identity=identity,
            user=user,
            workspace=invitation.workspace,
            role=user.role,
            token=token,
            expiry=timezone.now() + timedelta(days=30),
        )
        
        # Audit log
        create_user_audit_log(
            workspace=invitation.workspace,
            user=user,
            event_type=AuditEventType.USER_JOINED,
            metadata={"invite_code": invite_code, "method": "invite_code"},
        )
    
    # Create Loops contact outside transaction (fire-and-forget)
    create_loops_contact(user, "join_workspace")
    
    return AuthResponse(token=token)
