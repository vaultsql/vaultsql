"""
API endpoints for database and account management.

Databases represent database instances. Accounts represent access levels to a database
(e.g., readonly, admin). Each has its own encrypted credentials.

Credentials are arbitrary key-value dicts validated by each adapter.
"""

from django.db import transaction
from ninja import Router

from django.utils import timezone

from accounts.types import Request
from vaultsql.api_policies import BadRequest, require_admin, require_passphrase_for_vault
from connection.models import Access, AccessMode, AccountAccessLevel, Database, DatabaseAccount
from connection.adapters import get_adapter, ADAPTER_REGISTRY, test_connection_via_query_service
from connection.utils import set_database_credentials, set_account_credentials, get_credentials
from connection.policies import (
    get_database,
    get_account,
    check_duplicate_database_name,
    check_duplicate_account_name,
)
from connection.types import (
    DatabaseCreateRequest,
    DatabaseCreateWizardRequest,
    DatabaseUpdateRequest,
    DatabaseResponse,
    SetDatabaseCredentialsRequest,
    AccountCreateRequest,
    AccountCreateWizardRequest,
    AccountUpdateRequest,
    AccountResponse,
    SetAccountCredentialsRequest,
    TestConnectionRequest,
    TestConnectionResponse,
    SuccessResponse,
    DemoSetupRequest,
    DemoSetupResponse,
    DemoClearResponse,
)


api_database = Router()


def _database_response(database: Database) -> DatabaseResponse:
    """Build DatabaseResponse from model."""
    return DatabaseResponse(
        id=str(database.id),
        name=database.name,
        database_type=database.database_type,
        description=database.description,
        is_active=database.is_active,
        is_demo=database.is_demo,
        has_credentials=database.database_credential_id is not None,
        environment=database.environment,
        tags=[str(tag.id) for tag in database.tags.all()],
        created_at=database.created_at.isoformat(),
        updated_at=database.updated_at.isoformat(),
    )


def _account_response(account: DatabaseAccount) -> AccountResponse:
    """Build AccountResponse from model."""
    return AccountResponse(
        id=str(account.id),
        database_id=str(account.database_id),
        name=account.name,
        description=account.description,
        permissions=account.permissions,
        access_level=account.access_level,
        is_active=account.is_active,
        has_credentials=account.account_credential_id is not None,
        created_at=account.created_at.isoformat(),
        updated_at=account.updated_at.isoformat(),
    )


# ============ Database CRUD ============

@api_database.get("/", response=list[DatabaseResponse])
def list_databases(request: Request):
    """List all databases in the current workspace."""
    databases = Database.objects.filter(
        workspace=request.auth.workspace,
    ).order_by('name')

    return [_database_response(db) for db in databases]


@api_database.post("/create", response=DatabaseResponse)
def create_database_wizard(request: Request, data: DatabaseCreateWizardRequest, skip_check: bool = False):
    """
    Wizard endpoint to create a database and default account in one call.
    Validates credentials structure and tests connection before creating.
    Admin only.
    
    Args:
        skip_check: If True, skip connection testing (for unit tests without Go service).
    """
    require_admin(request)
    
    workspace = request.auth.workspace
    
    # Validate database_type
    if data.database_type not in ADAPTER_REGISTRY:
        valid_types = list(ADAPTER_REGISTRY.keys())
        raise BadRequest(f"Invalid database_type. Must be one of: {valid_types}")

    # Check for duplicate database name
    check_duplicate_database_name(workspace, data.name)
    
    # Get adapter for validation and testing
    try:
        adapter = get_adapter(data.database_type)
    except ValueError:
        raise BadRequest(f"No adapter for database type: {data.database_type}")
    
    # Validate database credentials structure
    is_valid, error = adapter.validate_database_credentials(data.database_credentials)
    if not is_valid:
        raise BadRequest(f"Invalid database credentials: {error}")
    
    # Validate account credentials structure
    is_valid, error = adapter.validate_account_credentials(data.account_credentials)
    if not is_valid:
        raise BadRequest(f"Invalid account credentials: {error}")
    
    # Test connection before creating anything (unless skipped for unit tests)
    if not skip_check:
        test_result = test_connection_via_query_service(
            database_type=data.database_type,
            database_credentials=data.database_credentials,
            account_credentials=data.account_credentials,
        )
        if not test_result.success:
            raise BadRequest(f"Connection test failed: {test_result.message}")
    
    # Handle passphrase for vault mode
    admin_passphrase = require_passphrase_for_vault(workspace, data.passphrase)
    
    # Create everything atomically
    try:
        with transaction.atomic():
            # Create database
            database = Database.objects.create(
                workspace=workspace,
                name=data.name,
                database_type=data.database_type,
                description=data.description,
                environment=data.environment,
            )

            # Set database credentials
            database_credential = set_database_credentials(
                database=database,
                credentials=data.database_credentials,
                admin_user=request.auth.user,
                admin_passphrase=admin_passphrase,
            )
            database.database_credential = database_credential
            database.save()

            # Check for duplicate account name
            check_duplicate_account_name(database, data.account_name)

            # Create account
            account = DatabaseAccount.objects.create(
                database=database,
                name=data.account_name,
                description=data.account_description,
                permissions={},
                access_level=data.access_level or AccountAccessLevel.READONLY.value,
            )

            # Set account credentials
            account_credential = set_account_credentials(
                account=account,
                credentials=data.account_credentials,
                admin_user=request.auth.user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = account_credential
            account.save()

            # Grant access to admin user
            Access.objects.create(
                workspace=workspace,
                account=account,
                user=request.auth.user,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=request.auth.user,
                granted_at=timezone.now(),
            )
            
    except ValueError as e:
        raise BadRequest(str(e))
    
    return _database_response(database)


@api_database.get("/{database_id}", response=DatabaseResponse)
def get_database_endpoint(request: Request, database_id: str):
    """Get a specific database."""
    database = get_database(request, database_id)
    return _database_response(database)


@api_database.post("/", response=DatabaseResponse)
def create_database(request: Request, data: DatabaseCreateRequest):
    """Create a new database. Admin only."""
    require_admin(request)

    if data.database_type not in ADAPTER_REGISTRY:
        valid_types = list(ADAPTER_REGISTRY.keys())
        raise BadRequest(f"Invalid database_type. Must be one of: {valid_types}")

    check_duplicate_database_name(request.auth.workspace, data.name)

    database = Database.objects.create(
        workspace=request.auth.workspace,
        name=data.name,
        database_type=data.database_type,
        description=data.description,
        environment=data.environment,
    )

    return _database_response(database)


@api_database.patch("/{database_id}", response=DatabaseResponse)
def update_database(request: Request, database_id: str, data: DatabaseUpdateRequest):
    """Update a database. Admin only."""
    require_admin(request)
    database = get_database(request, database_id)

    if data.name and data.name != database.name:
        check_duplicate_database_name(request.auth.workspace, data.name, exclude_id=database_id)
        database.name = data.name

    if data.description is not None:
        database.description = data.description
    if data.is_active is not None:
        database.is_active = data.is_active
    if data.environment is not None:
        database.environment = data.environment
    if data.tag_ids is not None:
        # Update M2M relationship
        from connection.models import DatabaseTag
        tags = DatabaseTag.objects.filter(id__in=data.tag_ids, workspace=request.auth.workspace)
        database.tags.set(tags)

    database.save()
    return _database_response(database)


@api_database.delete("/{database_id}", response=SuccessResponse)
def delete_database(request: Request, database_id: str):
    """Delete a database and all its accounts. Admin only."""
    require_admin(request)
    database = get_database(request, database_id)
    database.delete()
    return SuccessResponse(success=True)


# ============ Database Credentials ============

@api_database.post("/{database_id}/credentials", response=SuccessResponse)
def set_database_creds(request: Request, database_id: str, data: SetDatabaseCredentialsRequest):
    """
    Set or update database credentials.
    Admin only.
    
    For vault mode, admin must provide their passphrase.
    """
    require_admin(request)
    database = get_database(request, database_id)
    
    try:
        adapter = get_adapter(database.database_type)
    except ValueError:
        raise BadRequest(f"No adapter for database type: {database.database_type}")
    
    is_valid, error = adapter.validate_database_credentials(data.credentials)
    if not is_valid:
        raise BadRequest(f"Invalid credentials: {error}")
    
    workspace = request.auth.workspace
    admin_passphrase = require_passphrase_for_vault(workspace, data.passphrase)
    
    try:
        with transaction.atomic():
            credential = set_database_credentials(
                database=database,
                credentials=data.credentials,
                admin_user=request.auth.user,
                admin_passphrase=admin_passphrase,
            )
            database.database_credential = credential
            database.save()
    except ValueError as e:
        raise BadRequest(str(e))
    
    return SuccessResponse(success=True)


# ============ Account CRUD ============

@api_database.get("/{database_id}/accounts", response=list[AccountResponse])
def list_accounts(request: Request, database_id: str):
    """List all accounts for a database."""
    database = get_database(request, database_id)
    accounts = DatabaseAccount.objects.filter(database=database).order_by('name')
    return [_account_response(account) for account in accounts]


@api_database.get("/{database_id}/accounts/{account_id}", response=AccountResponse)
def get_account_endpoint(request: Request, database_id: str, account_id: str):
    """Get a specific account."""
    database = get_database(request, database_id)
    account = get_account(database, account_id)
    return _account_response(account)


@api_database.post("/{database_id}/accounts", response=AccountResponse)
def create_account(request: Request, database_id: str, data: AccountCreateRequest):
    """Create a new account for a database. Admin only."""
    require_admin(request)

    database = get_database(request, database_id)

    check_duplicate_account_name(database, data.name)

    account = DatabaseAccount.objects.create(
        database=database,
        name=data.name,
        description=data.description,
        permissions=data.permissions,
        access_level=data.access_level,
    )

    return _account_response(account)


@api_database.post("/{database_id}/account/create", response=AccountResponse)
def create_account_wizard(request: Request, database_id: str, data: AccountCreateWizardRequest, skip_check: bool = False):
    """
    Wizard endpoint to create an account with credentials in one call.
    Validates credentials structure and tests connection before creating.
    Admin only.
    
    Args:
        skip_check: If True, skip connection testing (for unit tests without Go service).
    """
    require_admin(request)
    
    workspace = request.auth.workspace
    database = get_database(request, database_id)
    
    # Check for duplicate account name
    check_duplicate_account_name(database, data.name)
    
    # Get adapter for validation and testing
    try:
        adapter = get_adapter(database.database_type)
    except ValueError:
        raise BadRequest(f"No adapter for database type: {database.database_type}")
    
    # Validate account credentials structure
    is_valid, error = adapter.validate_account_credentials(data.account_credentials)
    if not is_valid:
        raise BadRequest(f"Invalid account credentials: {error}")
    
    # Get database credentials for connection test
    if not database.database_credential:
        raise BadRequest("Database has no credentials configured. Set database credentials first.")
    
    # Handle passphrase for vault mode
    admin_passphrase = require_passphrase_for_vault(workspace, data.passphrase)
    
    # Get database credentials for testing (needed even with skip_check for later storage)
    try:
        database_credentials = get_credentials(
            credential=database.database_credential,
            user=request.auth.user,
            passphrase=admin_passphrase,
        )
    except ValueError as e:
        raise BadRequest(f"Failed to decrypt database credentials: {str(e)}")
    
    # Test connection before creating anything (unless skipped for unit tests)
    if not skip_check:
        test_result = test_connection_via_query_service(
            database_type=database.database_type,
            database_credentials=database_credentials,
            account_credentials=data.account_credentials,
        )
        if not test_result.success:
            raise BadRequest(f"Connection test failed: {test_result.message}")
    
    # Create everything atomically
    try:
        with transaction.atomic():
            # Create account
            account = DatabaseAccount.objects.create(
                database=database,
                name=data.name,
                description=data.description,
                permissions=data.permissions,
                access_level=data.access_level,
            )

            # Set account credentials
            account_credential = set_account_credentials(
                account=account,
                credentials=data.account_credentials,
                admin_user=request.auth.user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = account_credential
            account.save()

            # Grant access to admin user
            Access.objects.create(
                workspace=workspace,
                account=account,
                user=request.auth.user,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=request.auth.user,
                granted_at=timezone.now(),
            )
            
    except ValueError as e:
        raise BadRequest(str(e))
    
    return _account_response(account)


@api_database.patch("/{database_id}/accounts/{account_id}", response=AccountResponse)
def update_account(request: Request, database_id: str, account_id: str, data: AccountUpdateRequest):
    """Update an account. Admin only."""
    require_admin(request)
    database = get_database(request, database_id)
    account = get_account(database, account_id)

    if data.name and data.name != account.name:
        check_duplicate_account_name(database, data.name, exclude_id=account_id)
        account.name = data.name

    if data.description is not None:
        account.description = data.description
    if data.permissions is not None:
        account.permissions = data.permissions
    if data.is_active is not None:
        account.is_active = data.is_active
    if data.access_level is not None:
        account.access_level = data.access_level

    account.save()
    return _account_response(account)


@api_database.delete("/{database_id}/accounts/{account_id}", response=SuccessResponse)
def delete_account(request: Request, database_id: str, account_id: str):
    """Delete an account. Admin only."""
    require_admin(request)
    database = get_database(request, database_id)
    account = get_account(database, account_id)
    account.delete()
    return SuccessResponse(success=True)


# ============ Account Credentials ============

@api_database.post("/{database_id}/accounts/{account_id}/credentials", response=SuccessResponse)
def set_account_creds(request: Request, database_id: str, account_id: str, data: SetAccountCredentialsRequest):
    """
    Set or update account credentials (DB username/password).
    Admin only.
    
    For vault mode, admin must provide their passphrase.
    """
    require_admin(request)
    database = get_database(request, database_id)
    account = get_account(database, account_id)
    
    try:
        adapter = get_adapter(database.database_type)
    except ValueError:
        raise BadRequest(f"No adapter for database type: {database.database_type}")
    
    is_valid, error = adapter.validate_account_credentials(data.credentials)
    if not is_valid:
        raise BadRequest(f"Invalid credentials: {error}")
    
    workspace = request.auth.workspace
    admin_passphrase = require_passphrase_for_vault(workspace, data.passphrase)
    
    try:
        with transaction.atomic():
            credential = set_account_credentials(
                account=account,
                credentials=data.credentials,
                admin_user=request.auth.user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = credential
            account.save()
    except ValueError as e:
        raise BadRequest(str(e))
    
    return SuccessResponse(success=True)


# ============ Connection Testing ============

@api_database.post("/{database_id}/accounts/{account_id}/test", response=TestConnectionResponse)
def test_connection(request: Request, database_id: str, account_id: str, data: TestConnectionRequest):
    """
    Test connectivity using database + account credentials.
    
    Delegates to Go query service to ensure parity with actual query execution.
    For vault mode, user must provide their passphrase.
    """
    database = get_database(request, database_id)
    account = get_account(database, account_id)
    
    if not database.database_credential:
        raise BadRequest("Database has no credentials configured")

    if not account.account_credential:
        raise BadRequest("Account has no credentials configured")
    
    workspace = request.auth.workspace
    passphrase = require_passphrase_for_vault(workspace, data.passphrase)
    
    try:
        database_creds = get_credentials(
            credential=database.database_credential,
            user=request.auth.user,
            passphrase=passphrase,
        )
        account_creds = get_credentials(
            credential=account.account_credential,
            user=request.auth.user,
            passphrase=passphrase,
        )
    except ValueError as e:
        raise BadRequest(str(e))
    
    # Delegate to Go query service for connection testing
    result = test_connection_via_query_service(
        database_type=database.database_type,
        database_credentials=database_creds,
        account_credentials=account_creds,
    )
    
    return TestConnectionResponse(
        success=result.success,
        message=result.message,
        details=result.details,
    )


# ============ Demo Databases ============

# Demo database configuration (read-only Neon account)
DEMO_DB_CONFIG = {
    "hostname": "ep-holy-mouse-aduj9lb1-pooler.c-2.us-east-1.aws.neon.tech",
    "port": 5432,
    "ssl_mode": "require",
}

DEMO_ACCOUNT_CONFIG = {
    "username": "demo_readonly",
    "password": "NSkh/m36ccw2aF9sY2H9qTZ2S7ibbk8r",
}

DEMO_DATABASES = [
    {
        "name": "Los Pollos",
        "description": "Restaurant operations database (demo)",
        "database_name": "restaurant",
        "environment": "production",
    },
    {
        "name": "The Laundromat",
        "description": "Premium cleaning supplies distribution (demo)",
        "database_name": "laundromat",
        "environment": "staging",
    },
]


@api_database.post("/demo/setup", response=DemoSetupResponse)
def setup_demo_databases(request: Request, data: DemoSetupRequest):
    """
    Set up demo databases with pre-configured read-only connections.
    Creates Los Pollos (restaurant) and Laundromat demo databases.
    
    For vault mode, user must provide their passphrase.
    Skips databases that already exist (by name).
    """
    require_admin(request)
    
    workspace = request.auth.workspace
    admin_passphrase = require_passphrase_for_vault(workspace, data.passphrase)
    
    created_databases = []
    
    try:
        with transaction.atomic():
            for demo_db in DEMO_DATABASES:
                # Skip if database with this name already exists
                if Database.objects.filter(
                    workspace=workspace,
                    name=demo_db["name"],
                ).exists():
                    continue
                
                # Create database
                database = Database.objects.create(
                    workspace=workspace,
                    name=demo_db["name"],
                    database_type="postgres",
                    description=demo_db["description"],
                    environment=demo_db["environment"],
                    is_demo=True,
                )
                
                # Set database credentials (hostname, port, database name, ssl)
                database_credentials = {
                    **DEMO_DB_CONFIG,
                    "database": demo_db["database_name"],
                }
                database_credential = set_database_credentials(
                    database=database,
                    credentials=database_credentials,
                    admin_user=request.auth.user,
                    admin_passphrase=admin_passphrase,
                )
                database.database_credential = database_credential
                database.save()
                
                # Create readonly account
                account = DatabaseAccount.objects.create(
                    database=database,
                    name="readonly",
                    description="Read-only demo account",
                    permissions={},
                    access_level=AccountAccessLevel.READONLY.value,
                )
                
                # Set account credentials
                account_credential = set_account_credentials(
                    account=account,
                    credentials=DEMO_ACCOUNT_CONFIG,
                    admin_user=request.auth.user,
                    admin_passphrase=admin_passphrase,
                )
                account.account_credential = account_credential
                account.save()
                
                # Grant access to the requesting user
                Access.objects.create(
                    workspace=workspace,
                    account=account,
                    user=request.auth.user,
                    mode=AccessMode.ADMIN_SET.value,
                    granted_by=request.auth.user,
                    granted_at=timezone.now(),
                )
                
                created_databases.append(database)
    except ValueError as e:
        raise BadRequest(str(e))
    
    if not created_databases:
        return DemoSetupResponse(
            databases=[],
            message="Demo databases already exist in this workspace",
        )
    
    return DemoSetupResponse(
        databases=[_database_response(db) for db in created_databases],
        message=f"Created {len(created_databases)} demo database(s)",
    )


@api_database.delete("/demo/clear", response=DemoClearResponse)
def clear_demo_databases(request: Request):
    """
    Delete all demo databases in the workspace.
    Only deletes databases where is_demo=True.
    Admin only.
    """
    require_admin(request)
    
    workspace = request.auth.workspace
    
    # Get count before deletion
    demo_databases = Database.objects.filter(
        workspace=workspace,
        is_demo=True,
    )
    deleted_count = demo_databases.count()
    
    # Delete all demo databases (cascades to accounts, credentials, access)
    demo_databases.delete()
    
    return DemoClearResponse(
        deleted_count=deleted_count,
        message=f"Deleted {deleted_count} demo database(s)",
    )
