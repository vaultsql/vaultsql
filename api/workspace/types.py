"""Types and enums for workspace app."""
from enum import Enum
from ninja import Schema


class AuditEventType(str, Enum):
    """Types of auditable events."""
    QUERY_EXECUTE = "query.execute"
    QUERY_CANCEL = "query.cancel"
    USER_JOINED = "user.joined"
    ACCOUNT_ACCESS_REQUESTED = "account.access.requested"
    ACCOUNT_ACCESS_GRANTED = "account.access.granted"
    ACCOUNT_ACCESS_DENIED = "account.access.denied"
    ACCOUNT_ACCESS_REVOKED = "account.access.revoked"


class AuditActorType(str, Enum):
    """Who performed the action."""
    USER = "user"
    SYSTEM = "system"
    API_KEY = "api_key"


class QueryActorType(str, Enum):
    """Distinguishes the context of a query execution."""
    APPLICATION = "application"  # System ops like schema loading
    USER = "user"               # Direct user actions (CREATE TABLE, etc.)
    CUSTOM = "custom"           # Worksheet/ad-hoc queries


# ============ API Schemas ============

class AuditLogDownloadParams(Schema):
    start_date: str | None = None
    end_date: str | None = None


class WorkspaceSettingsResponse(Schema):
    audit_enabled: bool
    audit_store_queries: bool
    allowed_email_domains: list[str]
    workspace_name: str
    admin_email_domain: str | None = None
    is_free_email_domain: bool = False


class WorkspaceSettingsUpdateRequest(Schema):
    audit_enabled: bool | None = None
    audit_store_queries: bool | None = None
    allowed_email_domains: list[str] | None = None
    workspace_name: str | None = None


class AuditLogEntrySchema(Schema):
    """Single audit log entry."""
    id: str
    created_at: str  # ISO format timestamp
    actor_type: str
    actor_email: str | None
    event_type: str
    database_name: str | None
    query_actor_type: str | None
    database: str | None
    metadata: dict


class AuditLogListResponse(Schema):
    """Paginated audit log list response."""
    items: list[AuditLogEntrySchema]
    total: int
    page: int
    page_size: int