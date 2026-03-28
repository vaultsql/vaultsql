from typing import Any, Optional
from ninja import Schema


# ============ Key Management Schemas ============

class CreateKeyResponse(Schema):
    id: str
    passphrase: str
    passphrase_hint: str
    created_at: str


class UserKeyResponse(Schema):
    id: str
    user_id: str
    user_email: str
    passphrase_hint: str
    created_at: str
    confirmed_at: Optional[str] = None
    approved_at: Optional[str] = None
    revoked_at: Optional[str] = None


class ActivateKeyRequest(Schema):
    key_id: str
    admin_passphrase: str


class RevokeKeyRequest(Schema):
    key_id: str


class ConfirmKeyRequest(Schema):
    key_id: str


# ============ Database Schemas ============

class DatabaseCreateRequest(Schema):
    name: str
    database_type: str
    description: str = ""
    environment: Optional[str] = None


class DatabaseUpdateRequest(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    environment: Optional[str] = None
    tag_ids: Optional[list[str]] = None


class DatabaseResponse(Schema):
    id: str
    name: str
    database_type: str
    description: str
    is_active: bool
    is_demo: bool
    has_credentials: bool
    environment: Optional[str]
    tags: list[str]  # Tag IDs
    created_at: str
    updated_at: str


class SetDatabaseCredentialsRequest(Schema):
    """
    Database credentials - structure varies by adapter/database_type.
    The credentials dict is validated by the appropriate adapter.
    """
    credentials: dict[str, Any]
    # For vault mode
    passphrase: Optional[str] = None


class DatabaseCreateWizardRequest(Schema):
    """
    Wizard request to create a database and default account in one call.
    Validates credentials and tests connection before creating.
    """
    name: str
    database_type: str
    description: str = ""
    environment: Optional[str] = None
    account_name: str
    account_description: str = ""
    database_credentials: dict[str, Any]
    account_credentials: dict[str, Any]
    access_level: Optional[str] = "readonly"
    passphrase: Optional[str] = None


# ============ Database Account Schemas ============

class AccountCreateRequest(Schema):
    name: str
    description: str = ""
    permissions: dict[str, Any] = {}
    access_level: Optional[str] = "readonly"


class AccountCreateWizardRequest(Schema):
    """
    Wizard request to create an account for an existing database.
    Validates credentials and tests connection before creating.
    """
    name: str
    description: str = ""
    permissions: dict[str, Any] = {}
    access_level: Optional[str] = "readonly"
    account_credentials: dict[str, Any]
    passphrase: Optional[str] = None


class AccountUpdateRequest(Schema):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None
    access_level: Optional[str] = None


class AccountResponse(Schema):
    id: str
    database_id: str
    name: str
    description: str
    permissions: dict[str, Any]
    access_level: str
    is_active: bool
    has_credentials: bool
    created_at: str
    updated_at: str


class SetAccountCredentialsRequest(Schema):
    """
    Account credentials - structure varies by adapter/database_type.
    The credentials dict is validated by the appropriate adapter.
    """
    credentials: dict[str, Any]
    # For vault mode
    passphrase: Optional[str] = None


class TestConnectionRequest(Schema):
    """Request to test connection with current credentials."""
    passphrase: Optional[str] = None  # Required for vault mode


class TestConnectionResponse(Schema):
    success: bool
    message: str
    details: Optional[dict[str, Any]] = None


# ============ Access Control Schemas ============

class AccessGrantRequest(Schema):
    """Admin grants access to a user or group for an account."""
    database_id: str
    account_id: str
    user_id: Optional[str] = None
    group_id: Optional[str] = None
    granted_until: Optional[str] = None  # ISO format datetime


class AccessRequestRequest(Schema):
    """User requests access to an account."""
    database_id: str
    account_id: str
    timeout_hours: Optional[int] = None  # Default 12 hours
    reason: Optional[str] = None  # User-provided reason for request


class AccessRevokeRequest(Schema):
    """Admin revokes access for a user or group."""
    access_id: str


class AccessApproveRequest(Schema):
    """Admin approves an access request."""
    access_id: str


class AccessDenyRequest(Schema):
    """Admin denies an access request."""
    access_id: str


class AccessResponse(Schema):
    id: str
    account_id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    mode: str
    reason: Optional[str] = None
    requested_by_id: Optional[str] = None
    granted_by_id: Optional[str] = None
    denied_by_id: Optional[str] = None
    requested_at: Optional[str] = None
    granted_at: Optional[str] = None
    granted_until: Optional[str] = None
    denied_at: Optional[str] = None
    revoked_at: Optional[str] = None
    created_at: str
    updated_at: str


class PendingAccessRequestResponse(Schema):
    """Response for pending access requests with extra context."""
    id: str
    account_id: str
    account_name: str
    database_id: str
    database_name: str
    database_type: str
    user_id: str
    user_email: str
    user_name: str
    reason: Optional[str] = None
    requested_at: str
    granted_until: Optional[str] = None


class AccessRequestHistoryResponse(Schema):
    """Response for access request history with full context."""
    id: str
    # Requester info
    user_id: str
    user_email: str
    user_name: str
    # Database/Account info
    database_id: str
    database_name: str
    database_type: str
    account_id: str
    account_name: str
    access_level: str
    # Request details
    mode: str
    reason: Optional[str] = None
    # Status (derived field: pending, approved, denied, revoked, expired)
    status: str
    # Timestamps
    requested_at: str
    granted_at: Optional[str] = None
    granted_until: Optional[str] = None
    denied_at: Optional[str] = None
    revoked_at: Optional[str] = None
    # Actor info (includes both name and email)
    granted_by_id: Optional[str] = None
    granted_by_name: Optional[str] = None
    granted_by_email: Optional[str] = None
    denied_by_id: Optional[str] = None
    denied_by_name: Optional[str] = None
    denied_by_email: Optional[str] = None
    revoked_by_id: Optional[str] = None
    revoked_by_name: Optional[str] = None
    revoked_by_email: Optional[str] = None


# ============ Tag Schemas ============

class TagCreateRequest(Schema):
    name: str
    color: str = ""


class TagUpdateRequest(Schema):
    name: Optional[str] = None
    color: Optional[str] = None


class TagResponse(Schema):
    id: str
    name: str
    color: str
    created_at: str
    updated_at: str


# ============ Demo Database Schemas ============

class DemoSetupRequest(Schema):
    """Request to set up demo databases."""
    passphrase: Optional[str] = None  # Required for vault mode


class DemoSetupResponse(Schema):
    """Response from demo database setup."""
    databases: list[DatabaseResponse]
    message: str


class DemoClearResponse(Schema):
    """Response from clearing demo databases."""
    deleted_count: int
    message: str


# ============ Common Schemas ============

class SuccessResponse(Schema):
    success: bool
