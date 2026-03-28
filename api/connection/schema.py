from typing import Any
from ninja import Schema


class QueryRequest(Schema):
    query: str
    database_key: dict[str, Any] | None = None
    account_key: dict[str, Any] | None = None
    timeout: int | None = None
    max_rows: int | None = None


class KeysRequest(Schema):
    passphrase: str | None = None


class KeysResponse(Schema):
    database_key: dict[str, Any]
    account_key: dict[str, Any]


class QueryColumn(Schema):
    name: str
    type: str


class QueryResponse(Schema):
    success: bool
    error: str | None = None
    columns: list[QueryColumn] | None = None
    result: list[dict[str, Any]] | None = None


class CheckResponse(Schema):
    database_credentials: dict[str, Any]
    account_credentials: dict[str, Any]
    database_type: str


class AuditLogRequest(Schema):
    query: str
    query_actor_type: str  # "application", "user", "custom"
    database: str | None = None
    connectivity_error: bool | None = None  # True if connection failed, False if succeeded
    error_message: str | None = None  # Error message if connectivity_error=True


class AuditLogResponse(Schema):
    success: bool


class WorkbenchAccountResponse(Schema):
    """Account and database info for workbench initialization."""
    account_id: str
    account_name: str
    database_id: str
    database_name: str
    database_type: str
    access_level: str
    environment: str | None
    failure_rate_6h: float = 0.0  # 0.0-1.0, failure rate over last 6 hours

