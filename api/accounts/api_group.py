from uuid import UUID

from django.db import IntegrityError
from django.utils import timezone
from ninja import Router

from accounts.models import (
    GroupMembership,
    User,
    UserGroup,
    WorkspaceRole,
)
from accounts.schema import (
    GroupCreateRequest,
    GroupMemberRequest,
    GroupMemberResponse,
    GroupUpdateRequest,
    SuccessResponse,
    UpdateUserRoleRequest,
    UserGroupResponse,
    WorkspaceMemberResponse,
)
from accounts.types import Request
from vaultsql.api_policies import BadRequest, NotFound, require_admin


api_group = Router()


def _user_to_member_response(user: User) -> WorkspaceMemberResponse:
    """Convert User to WorkspaceMemberResponse.

    User now has workspace FK and role directly.
    """
    return WorkspaceMemberResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        image_url=user.identity.image_url,
    )


def _group_to_response(
    group: UserGroup,
    include_members: bool = False,
) -> UserGroupResponse:
    members = None
    if include_members:
        member_users = User.objects.filter(
            group_memberships__group=group
        ).order_by("email")
        members = [_user_to_member_response(u) for u in member_users]
    
    return UserGroupResponse(
        id=str(group.id),
        name=group.name,
        description=group.description,
        members=members,
    )


def _get_group_for_workspace(workspace_id: UUID, group_id: UUID) -> UserGroup:
    group = UserGroup.objects.filter(workspace_id=workspace_id, id=group_id).first()
    if not group:
        raise NotFound("Group not found")
    return group


@api_group.get("/users", response=list[WorkspaceMemberResponse])
def list_users(request: Request):
    """List all users in the workspace.

    Users now have workspace FK directly.
    """
    require_admin(request)
    users = User.objects.filter(workspace=request.auth.workspace).order_by("email")
    return [_user_to_member_response(u) for u in users]


@api_group.put("/users/{user_id}/role", response=WorkspaceMemberResponse)
def update_user_role(request: Request, user_id: UUID, data: UpdateUserRoleRequest):
    """Update user's role in the workspace.

    User.role is now on the User model directly.
    Signal will automatically sync to all active sessions.
    """
    require_admin(request)

    # Prevent self-role-change
    if user_id == request.auth.user.id:
        raise BadRequest("Cannot change your own role")

    valid_roles = [role.value for role in WorkspaceRole]
    if data.role not in valid_roles:
        raise BadRequest("Invalid role selection")

    user = User.objects.filter(
        workspace=request.auth.workspace,
        id=user_id,
    ).first()
    if not user:
        raise NotFound("User not found")
    user.role = data.role
    user.save(update_fields=["role"])
    return _user_to_member_response(user)


@api_group.delete("/users/{user_id}", response=SuccessResponse)
def deactivate_user(request: Request, user_id: UUID):
    """Soft-delete a user from the workspace.

    Sets deactivated_at timestamp which:
    - Revokes all active sessions (via signal)
    - Prevents future logins
    - Excludes user from listings (via UserManager)
    """
    require_admin(request)

    # Use all_objects to find user even if already deactivated
    user = User.all_objects.filter(
        workspace=request.auth.workspace,
        id=user_id,
        deactivated_at__isnull=True,
    ).first()
    if not user:
        raise NotFound("User not found")

    # Prevent self-deactivation
    if user.id == request.auth.user.id:
        raise BadRequest("Cannot deactivate yourself")

    user.deactivated_at = timezone.now()
    user.save(update_fields=["deactivated_at"])
    return SuccessResponse(success=True)


@api_group.get("/groups", response=list[UserGroupResponse])
def list_groups(request: Request, members: bool = False):
    require_admin(request)
    groups = UserGroup.objects.filter(workspace=request.auth.workspace).order_by("name")
    
    if members:
        groups = groups.prefetch_related("memberships__user")
    
    return [_group_to_response(group, include_members=members) for group in groups]


@api_group.post("/groups", response=UserGroupResponse)
def create_group(request: Request, data: GroupCreateRequest):
    require_admin(request)
    try:
        group = UserGroup.objects.create(
            workspace=request.auth.workspace,
            name=data.name,
            description=data.description or "",
        )
    except IntegrityError:
        raise BadRequest("Group with this name already exists")

    return _group_to_response(group)


@api_group.put("/groups/{group_id}", response=UserGroupResponse)
def update_group(request: Request, group_id: UUID, data: GroupUpdateRequest):
    require_admin(request)
    group = _get_group_for_workspace(request.auth.workspace_id, group_id)
    group.name = data.name
    group.description = data.description or ""

    try:
        group.save(update_fields=["name", "description"])
    except IntegrityError:
        raise BadRequest("Group with this name already exists")

    return _group_to_response(group)


@api_group.delete("/groups/{group_id}", response=SuccessResponse)
def delete_group(request: Request, group_id: UUID):
    require_admin(request)
    group = _get_group_for_workspace(request.auth.workspace_id, group_id)
    group.delete()
    return SuccessResponse(success=True)


@api_group.post("/groups/{group_id}/members", response=GroupMemberResponse)
def add_member_to_group(request: Request, group_id: UUID, data: GroupMemberRequest):
    """Add user to group.

    Users are now queried directly (have workspace FK).
    """
    require_admin(request)
    group = _get_group_for_workspace(request.auth.workspace_id, group_id)
    user = User.objects.filter(
        workspace=request.auth.workspace,
        id=data.user_id,
    ).first()
    if not user:
        raise NotFound("User not found")

    membership, _ = GroupMembership.objects.get_or_create(
        group=group,
        user=user,
    )
    return GroupMemberResponse(group_id=str(group.id), user_id=str(membership.user_id))


@api_group.delete("/groups/{group_id}/members/{user_id}", response=SuccessResponse)
def remove_member_from_group(request: Request, group_id: UUID, user_id: UUID):
    require_admin(request)
    group = _get_group_for_workspace(request.auth.workspace_id, group_id)
    membership = GroupMembership.objects.filter(group=group, user_id=user_id).first()
    if not membership:
        raise NotFound("Membership not found")

    membership.delete()
    return SuccessResponse(success=True)
