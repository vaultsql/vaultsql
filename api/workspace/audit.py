"""Utility functions for creating audit log entries."""
import hashlib
from uuid import UUID

from accounts.models import User, Workspace
from connection.models import Database
from workspace.models import AuditLog, WorkspaceSettings
from workspace.types import AuditEventType, AuditActorType, QueryActorType


def _get_query_hash(query_text: str) -> str:
    """Generate SHA256 hash of query text."""
    return hashlib.sha256(query_text.encode()).hexdigest()


def _should_store_query(workspace: Workspace) -> bool:
    """Check if workspace has opted in to storing raw queries."""
    try:
        return workspace.settings.audit_store_queries
    except WorkspaceSettings.DoesNotExist:
        return False


def is_audit_enabled(workspace: Workspace) -> bool:
    """Check if audit logging is enabled for the workspace."""
    try:
        return workspace.settings.audit_enabled
    except WorkspaceSettings.DoesNotExist:
        return True  # Default to enabled if no settings exist


def create_query_audit_log(
    workspace: Workspace,
    user: User,
    event_type: AuditEventType,
    query_actor_type: QueryActorType,
    query_text: str,
    database_instance: Database | None = None,
    database_id: UUID | None = None,
    database_name: str | None = None,
    database: str | None = None,
    metadata: dict | None = None,
) -> AuditLog | None:
    """
    Create an audit log entry for a query operation.
    
    Args:
        workspace: The workspace this audit belongs to
        user: The user who performed the action
        event_type: Type of event (QUERY_EXECUTE, QUERY_CANCEL)
        query_actor_type: Context of the query (APPLICATION, USER, CUSTOM)
        query_text: The SQL query text
        database_instance: Database object (optional, will extract id/name)
        database_id: Database UUID (used if database object not provided)
        database_name: Database name (used if database object not provided)
        database: Database name the query ran against
        metadata: Additional metadata dict
    
    Returns:
        The created AuditLog instance, or None if audit is disabled
    """
    if not is_audit_enabled(workspace):
        return None
    
    # Resolve database info
    resolved_database_id = database_instance.id if database_instance else database_id
    resolved_database_name = database_instance.name if database_instance else database_name
    
    # Determine if we should store the raw query
    store_query = _should_store_query(workspace)
    
    return AuditLog.objects.create(
        workspace=workspace,
        actor_type=AuditActorType.USER.value,
        actor_id=user.id,
        actor_email=user.email,
        event_type=event_type.value,
        database_id=resolved_database_id,
        database_name=resolved_database_name,
        query_actor_type=query_actor_type.value,
        query_hash=_get_query_hash(query_text),
        query_text=query_text if store_query else None,
        database=database,
        metadata=metadata or {},
    )


def create_system_audit_log(
    workspace: Workspace,
    event_type: AuditEventType,
    metadata: dict | None = None,
    database_instance: Database | None = None,
) -> AuditLog | None:
    """
    Create an audit log entry for a system operation.
    
    Args:
        workspace: The workspace this audit belongs to
        event_type: Type of event
        metadata: Additional metadata dict
        database_instance: Optional database object
    
    Returns:
        The created AuditLog instance, or None if audit is disabled
    """
    if not is_audit_enabled(workspace):
        return None
    
    return AuditLog.objects.create(
        workspace=workspace,
        actor_type=AuditActorType.SYSTEM.value,
        actor_id=None,
        actor_email=None,
        event_type=event_type.value,
        database_id=database_instance.id if database_instance else None,
        database_name=database_instance.name if database_instance else None,
        metadata=metadata or {},
    )


def create_user_audit_log(
    workspace: Workspace,
    user: User,
    event_type: AuditEventType,
    metadata: dict | None = None,
    database_instance: Database | None = None,
) -> AuditLog | None:
    """
    Create an audit log entry for a user action (non-query).
    
    Args:
        workspace: The workspace this audit belongs to
        user: The user who performed the action
        event_type: Type of event
        metadata: Additional metadata dict
        database_instance: Optional database object
    
    Returns:
        The created AuditLog instance, or None if audit is disabled
    """
    if not is_audit_enabled(workspace):
        return None
    
    return AuditLog.objects.create(
        workspace=workspace,
        actor_type=AuditActorType.USER.value,
        actor_id=user.id,
        actor_email=user.email,
        event_type=event_type.value,
        database_id=database_instance.id if database_instance else None,
        database_name=database_instance.name if database_instance else None,
        metadata=metadata or {},
    )
