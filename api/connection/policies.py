"""
Connection-specific policies and helpers.

These utilities are specific to connection management (databases, accounts, keys).
For generic API utilities, see vaultsql.api_policies.
"""

from django.db.models import Q
from django.utils import timezone

from accounts.models import Workspace, WorkspaceRole
from accounts.types import Request
from connection.models import Access, Database, DatabaseAccount, UserKey
from vaultsql.api_policies import NotFound, BadRequest, Forbidden


# ============ Object Fetchers ============

def get_database(request: Request, database_id: str) -> Database:
    """Fetch database or raise NotFound."""
    try:
        return Database.objects.get(
            id=database_id,
            workspace=request.auth.workspace,
        )
    except Database.DoesNotExist:
        raise NotFound("Database not found")


def get_account(database: Database, account_id: str) -> DatabaseAccount:
    """Fetch account for database or raise NotFound."""
    try:
        return DatabaseAccount.objects.get(
            id=account_id,
            database=database,
        )
    except DatabaseAccount.DoesNotExist:
        raise NotFound("Account not found")


def get_user_key(request: Request, key_id: str) -> UserKey:
    """Fetch user key or raise NotFound."""
    try:
        return UserKey.objects.get(
            id=key_id,
            workspace=request.auth.workspace,
        )
    except UserKey.DoesNotExist:
        raise NotFound("Key not found")


# ============ Validation Helpers ============

def check_duplicate_database_name(workspace: Workspace, name: str, exclude_id: str | None = None) -> None:
    """Raise BadRequest if database name already exists."""
    qs = Database.objects.filter(workspace=workspace, name=name)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    if qs.exists():
        raise BadRequest("Database with this name already exists")


def check_duplicate_account_name(database: Database, name: str, exclude_id: str | None = None) -> None:
    """Raise BadRequest if account name already exists for database."""
    qs = DatabaseAccount.objects.filter(database=database, name=name)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    if qs.exists():
        raise BadRequest("Account with this name already exists")


# ============ Access Checks ============

def check_account_access(request: Request, account: DatabaseAccount) -> None:
    """Check if user has access to the account. Raises Forbidden if not.
    
    Admins have implicit access to all accounts in their workspace.
    Non-admins require an explicit Access grant (direct or via group).
    """
    # Admins have implicit access to all accounts
    if request.auth.role == WorkspaceRole.ADMIN.value:
        return
    
    user = request.auth.user
    workspace = request.auth.workspace
    now = timezone.now()
    
    # Get user's groups in this workspace
    user_groups = user.group_memberships.filter(
        group__workspace=workspace
    ).values_list('group_id', flat=True)
    
    # Check for active access grant
    has_access = Access.objects.filter(
        Q(user=user) | Q(group_id__in=user_groups),
        account=account,
        revoked_at__isnull=True,
        granted_at__isnull=False,
    ).filter(
        Q(granted_until__isnull=True) | Q(granted_until__gt=now)
    ).exists()
    
    if not has_access:
        raise Forbidden("You do not have access to this account")
