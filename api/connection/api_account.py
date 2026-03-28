import random
from datetime import timedelta

from django.db.models import Q, Count
from django.utils import timezone
from django.conf import settings
from ninja import Router
from ninja.errors import HttpError

from accounts.models import WorkspaceMode
from accounts.types import Request
from connection.models import DatabaseAccount, AccountHealthLog
from connection.policies import check_account_access as require_account_access
from connection.utils import get_credentials
from vaultsql.api_policies import NotFound, BadRequest, Forbidden

from .schema import QueryRequest, KeysRequest, KeysResponse, CheckResponse, AuditLogRequest, AuditLogResponse, WorkbenchAccountResponse
from workspace.audit import create_query_audit_log
from workspace.types import AuditEventType, QueryActorType

api_account = Router()


@api_account.get("/{account_id}", response=WorkbenchAccountResponse)
def get_workbench_account(request: Request, account_id: str):
    """Get account and database info for workbench initialization."""
    workspace = request.auth.workspace
    
    # Get the account
    try:
        account = DatabaseAccount.objects.select_related('database').get(
            id=account_id,
            database__workspace=workspace,
            is_active=True,
            database__is_active=True,
        )
    except DatabaseAccount.DoesNotExist:
        raise NotFound("Account not found")

    # Check user has access to this account
    require_account_access(request, account)

    database = account.database
    
    # Calculate failure rate over last 6 hours
    failure_rate = _get_failure_rate_6h(account_id)

    return WorkbenchAccountResponse(
        account_id=str(account.id),
        account_name=account.name,
        database_id=str(database.id),
        database_name=database.name,
        database_type=database.database_type,
        access_level=account.access_level,
        environment=database.environment,
        failure_rate_6h=failure_rate,
    )


@api_account.post("/{account_id}/keys", response=KeysResponse)
def get_keys(request: Request, account_id: str, payload: KeysRequest):
    workspace = request.auth.workspace
    user = request.auth.user
    
    # Support vault mode
    is_vault = workspace.mode == WorkspaceMode.VAULT.value
    
    # Get the account
    try:
        account = DatabaseAccount.objects.select_related('database').get(
            id=account_id,
            database__workspace=workspace,
            is_active=True,
            database__is_active=True,
        )
    except DatabaseAccount.DoesNotExist:
        raise NotFound("Account not found")

    # Check user has access to this account
    require_account_access(request, account)

    database = account.database

    # Ensure database and account have credentials
    if not database.database_credential:
        raise BadRequest("Database credentials not configured")
    if not account.account_credential:
        raise BadRequest("Account credentials not configured")
    
    # Decrypt credentials
    try:
        database_key = get_credentials(
            database.database_credential,
            user, 
            passphrase=payload.passphrase if is_vault else None
        )
        account_key = get_credentials(
            account.account_credential,
            user, 
            passphrase=payload.passphrase if is_vault else None
        )
    except ValueError as e:
        raise BadRequest(str(e))
    
    return KeysResponse(
        database_key=database_key,
        account_key=account_key,
    )


@api_account.post("/{account_id}/check", response=CheckResponse)
def check_account_access(request: Request, account_id: str, payload: QueryRequest):
    """
    Verify user authorization and return decrypted credentials.
    
    This endpoint is designed to be called by the query microservice.
    It verifies:
    1. The X-Query-Secret header matches QUERY_SERVICE_SECRET
    2. The Bearer token is valid (handled by AuthWorkspace middleware)
    3. User has access to the account
    4. Returns decrypted database and account credentials
    
    Works similar to /run endpoint:
    - Vault mode: expects database_key and account_key in payload
    - Managed mode: decrypts credentials server-side
    """
    # Verify query service secret
    query_secret = request.headers.get('X-Query-Secret')
    expected_secret = getattr(settings, 'QUERY_SERVICE_SECRET', None)
    
    if not expected_secret:
        raise HttpError(500, "Query service not configured")
    
    if not query_secret or query_secret != expected_secret:
        raise Forbidden("Invalid query service secret")
    
    # User and workspace are already authenticated by AuthWorkspace middleware
    user = request.auth.user
    workspace = request.auth.workspace
    
    # Support vault mode
    is_vault = workspace.mode == WorkspaceMode.VAULT.value
    
    # Get the account
    try:
        account = DatabaseAccount.objects.select_related('database').get(
            id=account_id,
            database__workspace=workspace,
            is_active=True,
            database__is_active=True,
        )
    except DatabaseAccount.DoesNotExist:
        raise NotFound("Account not found")

    # Check user has access to this account
    require_account_access(request, account)

    database = account.database

    # Ensure database and account have credentials
    if not database.database_credential:
        raise BadRequest("Database credentials not configured")
    if not account.account_credential:
        raise BadRequest("Account credentials not configured")
    
    # Get credentials - either from payload (vault mode) or decrypt (managed mode)
    if is_vault:
        # Vault mode: use provided keys
        if not payload.database_key or not payload.account_key:
            raise BadRequest("database_key and account_key are required in vault mode")
        database_credentials = payload.database_key
        account_credentials = payload.account_key
    else:
        # Managed mode: decrypt credentials
        try:
            database_credentials = get_credentials(
                database.database_credential,
                user, 
                passphrase=None
            )
            account_credentials = get_credentials(
                account.account_credential,
                user, 
                passphrase=None
            )
        except ValueError as e:
            raise BadRequest(str(e))
    
    return CheckResponse(
        database_credentials=database_credentials,
        account_credentials=account_credentials,
        database_type=database.database_type,
    )


@api_account.post("/{account_id}/log", response=AuditLogResponse)
def log_query(request: Request, account_id: str, payload: AuditLogRequest):
    """
    Log a query execution to the audit log.
    
    This endpoint is designed to be called by the query microservice after
    executing a query. It verifies:
    1. The X-Query-Secret header matches QUERY_SERVICE_SECRET
    2. The Bearer token is valid (handled by AuthWorkspace middleware)
    3. User has access to the account
    
    Then creates an audit log entry for the query.
    """
    # Verify query service secret
    query_secret = request.headers.get('X-Query-Secret')
    expected_secret = getattr(settings, 'QUERY_SERVICE_SECRET', None)
    
    if not expected_secret:
        raise HttpError(500, "Query service not configured")
    
    if not query_secret or query_secret != expected_secret:
        raise Forbidden("Invalid query service secret")
    
    user = request.auth.user
    workspace = request.auth.workspace
    
    # Get the account
    try:
        account = DatabaseAccount.objects.select_related('database').get(
            id=account_id,
            database__workspace=workspace,
            is_active=True,
            database__is_active=True,
        )
    except DatabaseAccount.DoesNotExist:
        raise NotFound("Account not found")

    # Check user has access to this account
    require_account_access(request, account)

    database = account.database
    
    # Map string to enum
    query_actor_type_map = {
        "application": QueryActorType.APPLICATION,
        "user": QueryActorType.USER,
        "custom": QueryActorType.CUSTOM,
    }
    query_actor_type = query_actor_type_map.get(payload.query_actor_type, QueryActorType.CUSTOM)
    
    # Create audit log entry
    create_query_audit_log(
        workspace=workspace,
        user=user,
        event_type=AuditEventType.QUERY_EXECUTE,
        query_actor_type=query_actor_type,
        query_text=payload.query,
        database_instance=database,
        database=payload.database,
    )
    
    # Log connectivity health if provided (with sampling)
    if payload.connectivity_error is not None:
        success = not payload.connectivity_error
        if _should_sample_health_log(success):
            AccountHealthLog.objects.create(
                workspace=workspace,
                database=database,
                account=account,
                success=success,
                error_message=payload.error_message if payload.connectivity_error else None,
            )
    
    return AuditLogResponse(success=True)


def _should_sample_health_log(success: bool) -> bool:
    """
    Determine if this request should be sampled for health logging.
    
    Sample rates are configurable via Django settings:
    - ACCOUNT_HEALTH_SUCCESS_SAMPLE_RATE (default: 0.1 = 10%)
    - ACCOUNT_HEALTH_FAILURE_SAMPLE_RATE (default: 0.5 = 50%)
    """
    if success:
        rate = getattr(settings, 'ACCOUNT_HEALTH_SUCCESS_SAMPLE_RATE', 0.1)
    else:
        rate = getattr(settings, 'ACCOUNT_HEALTH_FAILURE_SAMPLE_RATE', 0.5)
    return random.random() < rate


def _get_failure_rate_6h(account_id: str) -> float:
    """
    Calculate failure rate over last 6 hours from sampled data.
    
    Accounts for different sample rates between success and failure:
    - Estimated true failures = sampled_failures / failure_sample_rate
    - Estimated true successes = sampled_successes / success_sample_rate
    - Failure rate = estimated_failures / (estimated_failures + estimated_successes)
    
    Returns 0.0 if:
    - No data available
    - Fewer than 5 sampled failures (not enough data for reliable estimate)
    
    Uses the composite index (account, created_at, success) for efficient querying.
    """
    cutoff = timezone.now() - timedelta(hours=6)
    stats = AccountHealthLog.objects.filter(
        account_id=account_id,
        created_at__gte=cutoff
    ).aggregate(
        total=Count('id'),
        failures=Count('id', filter=Q(success=False)),
        successes=Count('id', filter=Q(success=True))
    )
    
    sampled_failures = stats['failures'] or 0
    sampled_successes = stats['successes'] or 0
    
    # Require at least 5 sampled failures to report a meaningful failure rate
    if sampled_failures < 5:
        return 0.0
    
    # Get sample rates
    success_rate = getattr(settings, 'ACCOUNT_HEALTH_SUCCESS_SAMPLE_RATE', 0.1)
    failure_rate = getattr(settings, 'ACCOUNT_HEALTH_FAILURE_SAMPLE_RATE', 0.5)
    
    # Estimate true counts by dividing by sample rates
    estimated_failures = sampled_failures / failure_rate if failure_rate > 0 else 0
    estimated_successes = sampled_successes / success_rate if success_rate > 0 else 0
    
    total_estimated = estimated_failures + estimated_successes
    if total_estimated == 0:
        return 0.0
    
    return estimated_failures / total_estimated

