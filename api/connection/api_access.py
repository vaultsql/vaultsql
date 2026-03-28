"""
API endpoints for access control management.

Access can be granted to users or groups for specific accounts.
Users can request temporary access with a default 12-hour timeout.
"""

from datetime import timedelta
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from ninja import Router

from accounts.models import User, UserGroup, WorkspaceRole
from accounts.types import Request
from vaultsql.api_policies import BadRequest, Forbidden, require_admin
from connection.models import Access, DatabaseAccount, AccessMode
from connection.policies import get_database, get_account
from connection.types import (
    AccessGrantRequest,
    AccessRequestRequest,
    AccessRevokeRequest,
    AccessApproveRequest,
    AccessDenyRequest,
    AccessResponse,
    PendingAccessRequestResponse,
    AccessRequestHistoryResponse,
    SuccessResponse,
)
from workspace.audit import create_user_audit_log
from workspace.types import AuditEventType
from notifications.dispatch import notification_dispatch
from notifications.builders import (
    AccessRequestedNotificationBuilder,
    AccessApprovedNotificationBuilder,
    AccessDeniedNotificationBuilder,
)


api_access = Router()


def _access_response(access: Access) -> AccessResponse:
    """Build AccessResponse from model."""
    return AccessResponse(
        id=str(access.id),
        account_id=str(access.account_id),
        user_id=str(access.user_id) if access.user_id else None,
        user_email=access.user.email if access.user else None,
        group_id=str(access.group_id) if access.group_id else None,
        group_name=access.group.name if access.group else None,
        mode=access.mode,
        reason=access.reason or None,
        requested_by_id=str(access.requested_by_id) if access.requested_by_id else None,
        granted_by_id=str(access.granted_by_id) if access.granted_by_id else None,
        denied_by_id=str(access.denied_by_id) if access.denied_by_id else None,
        requested_at=access.requested_at.isoformat() if access.requested_at else None,
        granted_at=access.granted_at.isoformat() if access.granted_at else None,
        granted_until=access.granted_until.isoformat() if access.granted_until else None,
        denied_at=access.denied_at.isoformat() if access.denied_at else None,
        revoked_at=access.revoked_at.isoformat() if access.revoked_at else None,
        created_at=access.created_at.isoformat(),
        updated_at=access.updated_at.isoformat(),
    )


# ============ Access Management ============

@api_access.post("/grant", response=AccessResponse)
def grant_access(request: Request, data: AccessGrantRequest):
    """Grant user or group access to an account. Admin only."""
    require_admin(request)

    database = get_database(request, data.database_id)
    account = get_account(database, data.account_id)
    
    # Validate that exactly one of user or group is specified
    if (data.user_id and data.group_id) or (not data.user_id and not data.group_id):
        raise BadRequest("Exactly one of user_id or group_id must be specified")
    
    # Validate user or group belongs to workspace
    user = None
    group = None
    
    if data.user_id:
        try:
            user = User.objects.get(id=data.user_id)
            # Check user is in workspace
            if user.workspace_id != request.auth.workspace.id:
                raise BadRequest("User is not a member of this workspace")
        except User.DoesNotExist:
            raise BadRequest("User not found")
    
    if data.group_id:
        try:
            group = UserGroup.objects.get(id=data.group_id, workspace=request.auth.workspace)
        except UserGroup.DoesNotExist:
            raise BadRequest("Group not found")
    
    # Check for existing active access
    existing = Access.objects.filter(
        workspace=request.auth.workspace,
        account=account,
        user=user,
        group=group,
        revoked_at__isnull=True,
    ).first()
    
    if existing:
        raise BadRequest("Access already granted")
    
    # Create access grant
    with transaction.atomic():
        access = Access.objects.create(
            workspace=request.auth.workspace,
            account=account,
            user=user,
            group=group,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=request.auth.user,
            granted_at=timezone.now(),
            granted_until=data.granted_until,
        )
        
        # Audit log
        create_user_audit_log(
            workspace=request.auth.workspace,
            user=request.auth.user,
            event_type=AuditEventType.ACCOUNT_ACCESS_GRANTED,
            database_instance=database,
            metadata={
                "account_id": str(account.id),
                "account_name": account.name,
                "target_user_id": str(user.id) if user else None,
                "target_user_email": user.email if user else None,
                "target_group_id": str(group.id) if group else None,
                "target_group_name": group.name if group else None,
            },
        )
    
    return _access_response(access)


@api_access.post("/request", response=AccessResponse)
def request_access(request: Request, data: AccessRequestRequest):
    """Request access to an account. Default timeout is 12 hours."""
    database = get_database(request, data.database_id)
    account = get_account(database, data.account_id)
    
    # Check for existing active access (not denied, not revoked)
    existing = Access.objects.filter(
        workspace=request.auth.workspace,
        account=account,
        user=request.auth.user,
        revoked_at__isnull=True,
        denied_at__isnull=True,
    ).first()
    
    if existing:
        if existing.granted_at:
            raise BadRequest("You already have access to this account")
        else:
            raise BadRequest("You already have a pending access request for this account")
    
    # Default timeout: 12 hours
    timeout_hours = data.timeout_hours if data.timeout_hours is not None else 12
    if timeout_hours <= 0 or timeout_hours > 168:  # Max 1 week
        raise BadRequest("Timeout must be between 1 and 168 hours")
    
    granted_until = timezone.now() + timedelta(hours=timeout_hours)
    
    # Create access request
    with transaction.atomic():
        access = Access.objects.create(
            workspace=request.auth.workspace,
            account=account,
            user=request.auth.user,
            mode=AccessMode.REQUESTED.value,
            requested_by=request.auth.user,
            requested_at=timezone.now(),
            granted_until=granted_until,
            reason=data.reason or "",
        )
        
        # Audit log
        create_user_audit_log(
            workspace=request.auth.workspace,
            user=request.auth.user,
            event_type=AuditEventType.ACCOUNT_ACCESS_REQUESTED,
            database_instance=database,
            metadata={
                "account_id": str(account.id),
                "account_name": account.name,
                "reason": data.reason or "",
                "timeout_hours": timeout_hours,
            },
        )
        
        # Send notification to all workspace admins
        admins = User.objects.filter(
            workspace=request.auth.workspace,
            role=WorkspaceRole.ADMIN.value,
            deactivated_at__isnull=True,
        )
        
        builder = AccessRequestedNotificationBuilder(access)
        for admin in admins:
            notification_dispatch(
                workspace=request.auth.workspace,
                recipient=admin,
                builder=builder,
            )
    
    return _access_response(access)


@api_access.get("/user/{user_id}", response=list[AccessResponse])
def list_user_access(request: Request, user_id: str):
    """Get all access for a user. Admins can see all, users can only see their own."""
    # Handle "me" special case
    if user_id == "me":
        user_id = str(request.auth.user.id)
    
    # Non-admins can only view their own access
    if request.auth.role != "admin" and user_id != str(request.auth.user.id):
        raise Forbidden("You can only view your own access")
    
    # Verify user exists and is in workspace
    try:
        user = User.objects.get(id=user_id)
        if user.workspace_id != request.auth.workspace.id:
            raise BadRequest("User is not a member of this workspace")
    except User.DoesNotExist:
        raise BadRequest("User not found")

    # Get all groups the user belongs to
    user_groups = UserGroup.objects.filter(
        memberships__user=user,
        workspace=request.auth.workspace
    )

    # Get all access for user (direct user access OR group access)
    access_list = Access.objects.filter(
        Q(workspace=request.auth.workspace) &
        (Q(user=user) | Q(group__in=user_groups))
    ).select_related('account', 'user', 'group', 'requested_by', 'granted_by').order_by('-created_at')

    return [_access_response(a) for a in access_list]


@api_access.get("/account/{database_id}/{account_id}", response=list[AccessResponse])
def list_account_access(request: Request, database_id: str, account_id: str):
    """Get all access for an account."""
    database = get_database(request, database_id)
    account = get_account(database, account_id)

    # Get all access for account
    access_list = Access.objects.filter(
        workspace=request.auth.workspace,
        account=account,
    ).select_related('account', 'user', 'group', 'requested_by', 'granted_by').order_by('-created_at')
    
    return [_access_response(a) for a in access_list]


@api_access.post("/revoke", response=SuccessResponse)
def revoke_access(request: Request, data: AccessRevokeRequest):
    """Revoke access for a user or group. Admin only."""
    require_admin(request)
    
    try:
        access = Access.objects.select_related('account', 'account__database', 'user', 'group').get(
            id=data.access_id,
            workspace=request.auth.workspace,
        )
    except Access.DoesNotExist:
        raise BadRequest("Access not found")
    
    if access.revoked_at:
        raise BadRequest("Access already revoked")
    
    with transaction.atomic():
        access.revoked_at = timezone.now()
        access.revoked_by = request.auth.user
        access.save(update_fields=['revoked_at', 'revoked_by', 'updated_at'])
        
        # Audit log
        create_user_audit_log(
            workspace=request.auth.workspace,
            user=request.auth.user,
            event_type=AuditEventType.ACCOUNT_ACCESS_REVOKED,
            database_instance=access.account.database,
            metadata={
                "account_id": str(access.account.id),
                "account_name": access.account.name,
                "target_user_id": str(access.user.id) if access.user else None,
                "target_user_email": access.user.email if access.user else None,
                "target_group_id": str(access.group.id) if access.group else None,
                "target_group_name": access.group.name if access.group else None,
            },
        )
    
    return SuccessResponse(success=True)


@api_access.get("/pending", response=list[PendingAccessRequestResponse])
def list_pending_requests(request: Request):
    """Get all pending access requests. Admin only."""
    require_admin(request)
    
    # Pending = requested_at is set, but granted_at and denied_at are null
    pending = Access.objects.filter(
        workspace=request.auth.workspace,
        mode=AccessMode.REQUESTED.value,
        requested_at__isnull=False,
        granted_at__isnull=True,
        denied_at__isnull=True,
        revoked_at__isnull=True,
    ).select_related(
        'account', 'account__database', 'user', 'requested_by'
    ).order_by('-requested_at')
    
    return [
        PendingAccessRequestResponse(
            id=str(access.id),
            account_id=str(access.account.id),
            account_name=access.account.name,
            database_id=str(access.account.database.id),
            database_name=access.account.database.name,
            database_type=access.account.database.database_type,
            user_id=str(access.user.id),
            user_email=access.user.email,
            user_name=access.user.name,
            reason=access.reason or None,
            requested_at=access.requested_at.isoformat(),
            granted_until=access.granted_until.isoformat() if access.granted_until else None,
        )
        for access in pending
    ]


@api_access.post("/approve", response=AccessResponse)
def approve_access(request: Request, data: AccessApproveRequest):
    """Approve a pending access request. Admin only."""
    require_admin(request)
    
    try:
        access = Access.objects.select_related(
            'account', 'account__database', 'user', 'requested_by'
        ).get(
            id=data.access_id,
            workspace=request.auth.workspace,
        )
    except Access.DoesNotExist:
        raise BadRequest("Access request not found")
    
    # Validate it's a pending request
    if access.granted_at:
        raise BadRequest("Access request has already been approved")
    if access.denied_at:
        raise BadRequest("Access request has already been denied")
    if access.revoked_at:
        raise BadRequest("Access request has been revoked")
    if not access.requested_at:
        raise BadRequest("This is not an access request")
    
    with transaction.atomic():
        access.granted_at = timezone.now()
        access.granted_by = request.auth.user
        access.save(update_fields=['granted_at', 'granted_by', 'updated_at'])
        
        # Audit log
        create_user_audit_log(
            workspace=request.auth.workspace,
            user=request.auth.user,
            event_type=AuditEventType.ACCOUNT_ACCESS_GRANTED,
            database_instance=access.account.database,
            metadata={
                "account_id": str(access.account.id),
                "account_name": access.account.name,
                "target_user_id": str(access.user.id),
                "target_user_email": access.user.email,
                "approved_request": True,
            },
        )
        
        # Send notification to requester
        if access.requested_by:
            builder = AccessApprovedNotificationBuilder(access)
            notification_dispatch(
                workspace=request.auth.workspace,
                recipient=access.requested_by,
                builder=builder,
            )
    
    return _access_response(access)


@api_access.post("/deny", response=AccessResponse)
def deny_access(request: Request, data: AccessDenyRequest):
    """Deny a pending access request. Admin only."""
    require_admin(request)
    
    try:
        access = Access.objects.select_related(
            'account', 'account__database', 'user', 'requested_by'
        ).get(
            id=data.access_id,
            workspace=request.auth.workspace,
        )
    except Access.DoesNotExist:
        raise BadRequest("Access request not found")
    
    # Validate it's a pending request
    if access.granted_at:
        raise BadRequest("Access request has already been approved")
    if access.denied_at:
        raise BadRequest("Access request has already been denied")
    if access.revoked_at:
        raise BadRequest("Access request has been revoked")
    if not access.requested_at:
        raise BadRequest("This is not an access request")
    
    with transaction.atomic():
        access.denied_at = timezone.now()
        access.denied_by = request.auth.user
        access.save(update_fields=['denied_at', 'denied_by', 'updated_at'])
        
        # Audit log
        create_user_audit_log(
            workspace=request.auth.workspace,
            user=request.auth.user,
            event_type=AuditEventType.ACCOUNT_ACCESS_DENIED,
            database_instance=access.account.database,
            metadata={
                "account_id": str(access.account.id),
                "account_name": access.account.name,
                "target_user_id": str(access.user.id),
                "target_user_email": access.user.email,
            },
        )
        
        # Send notification to requester
        if access.requested_by:
            builder = AccessDeniedNotificationBuilder(access)
            notification_dispatch(
                workspace=request.auth.workspace,
                recipient=access.requested_by,
                builder=builder,
            )
    
    return _access_response(access)


@api_access.get("/history", response=list[AccessRequestHistoryResponse])
def list_access_request_history(request: Request):
    """Get last 50 access requests for the workspace. Admin only."""
    require_admin(request)
    
    # Get all access requests (mode=REQUESTED) ordered by requested_at
    requests = Access.objects.filter(
        workspace=request.auth.workspace,
        mode=AccessMode.REQUESTED.value,
        requested_at__isnull=False,
    ).select_related(
        'account', 'account__database', 'user',
        'granted_by', 'denied_by', 'revoked_by'
    ).order_by('-requested_at')[:50]
    
    result = []
    for access in requests:
        # Determine status
        if access.revoked_at:
            status = "revoked"
        elif access.denied_at:
            status = "denied"
        elif access.granted_at:
            # Check if expired
            if access.granted_until and access.granted_until < timezone.now():
                status = "expired"
            else:
                status = "approved"
        else:
            status = "pending"
        
        result.append(AccessRequestHistoryResponse(
            id=str(access.id),
            # Requester info
            user_id=str(access.user.id),
            user_email=access.user.email,
            user_name=access.user.name,
            # Database/Account info
            database_id=str(access.account.database.id),
            database_name=access.account.database.name,
            database_type=access.account.database.database_type,
            account_id=str(access.account.id),
            account_name=access.account.name,
            access_level=access.account.access_level,
            # Request details
            mode=access.mode,
            reason=access.reason or None,
            status=status,
            # Timestamps
            requested_at=access.requested_at.isoformat(),
            granted_at=access.granted_at.isoformat() if access.granted_at else None,
            granted_until=access.granted_until.isoformat() if access.granted_until else None,
            denied_at=access.denied_at.isoformat() if access.denied_at else None,
            revoked_at=access.revoked_at.isoformat() if access.revoked_at else None,
            # Actor info
            granted_by_id=str(access.granted_by.id) if access.granted_by else None,
            granted_by_name=access.granted_by.name if access.granted_by else None,
            granted_by_email=access.granted_by.email if access.granted_by else None,
            denied_by_id=str(access.denied_by.id) if access.denied_by else None,
            denied_by_name=access.denied_by.name if access.denied_by else None,
            denied_by_email=access.denied_by.email if access.denied_by else None,
            revoked_by_id=str(access.revoked_by.id) if access.revoked_by else None,
            revoked_by_name=access.revoked_by.name if access.revoked_by else None,
            revoked_by_email=access.revoked_by.email if access.revoked_by else None,
        ))
    
    return result
