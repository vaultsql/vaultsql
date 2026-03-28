from ninja import Schema
from pydantic import EmailStr


class SignupRequest(Schema):
    # Use plain string to allow dev/test domains like `.local`
    email: str
    password: str
    name: str


class LoginRequest(Schema):
    # Use plain string to allow dev/test domains like `.local`
    email: str
    password: str


class RequestLoginCodeRequest(Schema):
    email: str


class VerifyLoginCodeRequest(Schema):
    email: str
    code: str


class IdentityResponse(Schema):
    id: str
    email: EmailStr
    name: str
    image_url: str | None = None


class IdentityAuthResponse(Schema):
    token: str
    identity: IdentityResponse
    needs_onboarding: bool


class GoogleAuthStartResponse(Schema):
    auth_url: str
    state: str


class GoogleAuthCompleteRequest(Schema):
    code: str
    state: str


class UserResponse(Schema):
    id: str
    email: str
    name: str
    image_url: str | None = None


class WorkspaceResponse(Schema):
    id: str
    name: str
    slug: str
    role: str
    mode: str
    image_url: str | None = None


class IdentityWorkspaceResponse(Schema):
    id: str
    name: str
    slug: str
    role: str | None
    mode: str
    image_url: str | None = None


class WorkspaceCreateRequest(Schema):
    name: str
    slug: str | None = None
    mode: str = "streamlined"
    user_name: str
    referrer: str | None = None


class JoinWorkspaceRequest(Schema):
    user_name: str | None = None


class TokenResponse(Schema):
    token: str


class AuthResponse(Schema):
    token: str


class CurrentKeyResponse(Schema):
    """
    User's current key info for vault mode.
    
    This is the latest confirmed, non-revoked key. From this we derive:
    - key is None → needs_key_create (user has no confirmed key)
    - key.approved_at is None → needs_key_approval (key awaiting admin approval)
    - key.approved_at is set → active key ready for use
    """
    id: str
    passphrase_hint: str
    created_at: str
    confirmed_at: str
    approved_at: str | None = None


class UserFlags(Schema):
    is_solo_admin: bool
    needs_key_create: bool = False
    needs_key_approval: bool = False


class IdentityMeResponse(Schema):
    session_type: str  # "identity"
    identity: IdentityResponse
    workspaces: list[WorkspaceResponse]


class WorkspaceMeResponse(Schema):
    session_type: str  # "workspace"
    user: UserResponse
    workspace: WorkspaceResponse
    workspaces: list[WorkspaceResponse]
    flags: UserFlags
    key: CurrentKeyResponse | None = None


class SwitchWorkspaceRequest(Schema):
    workspace_id: str


class WorkspaceSwitchResponse(Schema):
    workspace: WorkspaceResponse


class LogoutResponse(Schema):
    success: bool


class WorkspaceMemberResponse(Schema):
    id: str
    email: str
    name: str
    role: str
    image_url: str | None = None


class UpdateUserRoleRequest(Schema):
    role: str


class UpdateProfileRequest(Schema):
    name: str | None = None


class UserGroupResponse(Schema):
    id: str
    name: str
    description: str
    members: list[WorkspaceMemberResponse] | None = None


class GroupCreateRequest(Schema):
    name: str
    description: str | None = None


class GroupUpdateRequest(Schema):
    name: str
    description: str | None = None


class GroupMemberRequest(Schema):
    user_id: str


class GroupMemberResponse(Schema):
    group_id: str
    user_id: str


class SuccessResponse(Schema):
    success: bool


class TestPassphraseRequest(Schema):
    passphrase: str


class TestPassphraseResponse(Schema):
    success: bool


class WorkspaceInvitationResponse(Schema):
    id: str
    token: str
    created_at: str
    revoked_at: str | None
    expires_at: str | None
    max_uses: int | None
    use_count: int
