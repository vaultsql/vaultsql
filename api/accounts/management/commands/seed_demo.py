from __future__ import annotations

from dataclasses import dataclass
from os import environ
from urllib.parse import urlparse, parse_qs

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import (
    GroupMembership,
    Identity,
    MagicLink,
    PasswordResetToken,
    Session,
    User,
    UserGroup,
    Workspace,
    WorkspaceMode,
    WorkspaceRole,
)
from connection.crypto import generate_user_keypair, get_passphrase_hint, encrypt_with_public_key
from connection.models import Access, AccessMode, AccountAccessLevel, Credential, Database, DatabaseAccount, DatabaseEnvironment, UserCredential, UserKey
from connection.utils import activate_key, set_account_credentials, set_database_credentials
from workbench.models import Folder, Worksheet


SEED_PASSWORD = "Insecure42"
VAULT_PASSPHRASE = "crystal blue"

# Required environment variables
REQUIRED_ENV_VARS = [
    "NEON_DEMO_CONNECTION_STRING",
]


def parse_neon_connection_string(connection_string: str) -> dict[str, str | int]:
    """
    Parse Neon connection string and extract components.

    Expected format:
    postgresql://user:password@host:port/database?sslmode=require&channel_binding=require

    Returns dict with: hostname, port, ssl_mode, username, password, database
    """
    parsed = urlparse(connection_string)

    # Extract query parameters
    query_params = parse_qs(parsed.query)
    ssl_mode = query_params.get('sslmode', ['prefer'])[0]

    return {
        'hostname': parsed.hostname or '',
        'port': parsed.port or 5432,
        'ssl_mode': ssl_mode,
        'username': parsed.username or '',
        'password': parsed.password or '',
        'database': parsed.path.lstrip('/') if parsed.path else '',
    }


def validate_env_vars() -> None:
    """Validate that all required environment variables are set."""
    missing = [var for var in REQUIRED_ENV_VARS if not environ.get(var)]
    if missing:
        raise CommandError(
            f"Missing required environment variables: {', '.join(missing)}\n"
            f"Please ensure all variables are set in env.txt"
        )


# Parse Neon connection string (required, no fallback)
NEON_DEMO_CONNECTION_STRING = environ.get("NEON_DEMO_CONNECTION_STRING", "")
if not NEON_DEMO_CONNECTION_STRING:
    raise CommandError(
        "NEON_DEMO_CONNECTION_STRING is required. Please set it in env.txt"
    )

_neon_parsed = parse_neon_connection_string(NEON_DEMO_CONNECTION_STRING)
TEST_PG_HOST = _neon_parsed['hostname']
TEST_PG_PORT = _neon_parsed['port']

# All credentials from parsed Neon connection string
TEST_READ_USER = _neon_parsed['username']
TEST_READ_PASS = _neon_parsed['password']
TEST_ADMIN_USER = _neon_parsed['username']
TEST_ADMIN_PASS = _neon_parsed['password']


@dataclass(frozen=True)
class SeedUser:
    name: str
    email: str
    role: str


@dataclass(frozen=True)
class SeedWorkspace:
    name: str
    slug: str
    mode: str
    users: tuple[SeedUser, ...]
    groups: tuple[tuple[str, str], ...]


WORKSPACES = (
    SeedWorkspace(
        name="Los Pollos Hermanos",
        slug="los-pollos-hermanos",
        mode=WorkspaceMode.VAULT.value,
        users=(
            SeedUser("Gus Fring", "demo+gus@vaultsql.com", WorkspaceRole.ADMIN.value),
            SeedUser("Lydia Rodarte-Quayle", "demo+lydia@vaultsql.com", WorkspaceRole.ADMIN.value),
            SeedUser("Walt White", "demo+walt@vaultsql.com", WorkspaceRole.MEMBER.value),
            SeedUser("Jesse Pinkman", "demo+jesse@vaultsql.com", WorkspaceRole.MEMBER.value),
            SeedUser("Mike Ehrmantraut", "demo+mike@vaultsql.com", WorkspaceRole.MEMBER.value),
            SeedUser("Saul Goodman", "demo+saul@vaultsql.com", WorkspaceRole.MEMBER.value),
            SeedUser("Hank Schrader", "demo+hank@vaultsql.com", WorkspaceRole.MEMBER.value),
            SeedUser("Skyler White", "demo+skyler@vaultsql.com", WorkspaceRole.MEMBER.value),
        ),
        groups=(
            ("Executive Circle", "High priority approvals and oversight."),
            ("Distribution Crew", "General access group for distribution."),
        ),
    ),
)


class Command(BaseCommand):
    help = "Seed demo data for VaultSQL workspaces, users, and connections."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing seed data before re-creating it.",
        )

    def handle(self, *args, **options):
        # Validate environment variables before proceeding
        validate_env_vars()
        
        reset = options["reset"]

        existing = self._seed_exists()
        if existing and not reset:
            raise CommandError(
                "Seed data already exists. Re-run with --reset to overwrite it."
            )

        with transaction.atomic():
            if reset:
                self._reset_seed_data()

            created = self._seed_data()

        self.stdout.write(self.style.SUCCESS(created))

    def _seed_exists(self) -> bool:
        workspace_slugs = [workspace.slug for workspace in WORKSPACES]
        user_emails = [user.email for workspace in WORKSPACES for user in workspace.users]
        return Workspace.objects.filter(slug__in=workspace_slugs).exists() or User.objects.filter(
            email__in=user_emails
        ).exists()

    def _reset_seed_data(self) -> None:
        workspace_slugs = [workspace.slug for workspace in WORKSPACES]
        user_emails = [user.email for workspace in WORKSPACES for user in workspace.users]

        workspaces = Workspace.objects.filter(slug__in=workspace_slugs)
        workspace_ids = list(workspaces.values_list("id", flat=True))

        if workspace_ids:
            Access.objects.filter(account__database__workspace_id__in=workspace_ids).delete()
            UserCredential.objects.filter(credential__workspace_id__in=workspace_ids).delete()
            DatabaseAccount.objects.filter(database__workspace_id__in=workspace_ids).delete()
            Database.objects.filter(workspace_id__in=workspace_ids).delete()
            Credential.objects.filter(workspace_id__in=workspace_ids).delete()
            UserKey.objects.filter(workspace_id__in=workspace_ids).delete()
            GroupMembership.objects.filter(group__workspace_id__in=workspace_ids).delete()
            UserGroup.objects.filter(workspace_id__in=workspace_ids).delete()
            Session.objects.filter(workspace_id__in=workspace_ids).delete()
            workspaces.delete()

        seed_users = User.objects.filter(email__in=user_emails)
        if seed_users.exists():
            MagicLink.objects.filter(user__in=seed_users).delete()
            PasswordResetToken.objects.filter(user__in=seed_users).delete()
            seed_users.delete()

        Identity.objects.filter(email__in=user_emails).delete()

    def _seed_data(self) -> str:
        for workspace_seed in WORKSPACES:
            workspace = Workspace.objects.create(
                name=workspace_seed.name,
                slug=workspace_seed.slug,
                mode=workspace_seed.mode,
            )

            users_by_email = {}
            for user_seed in workspace_seed.users:
                user = User.objects.create_user(
                    email=user_seed.email,
                    password=SEED_PASSWORD,
                    workspace=workspace,
                    role=user_seed.role,
                )
                # Update identity name if not set
                if user_seed.name and not user.identity.name:
                    user.identity.name = user_seed.name
                    user.identity.save()
                users_by_email[user.email] = user

            admin_user = next(
                users_by_email[user_seed.email]
                for user_seed in workspace_seed.users
                if user_seed.role == WorkspaceRole.ADMIN.value
            )

            if workspace.mode == WorkspaceMode.VAULT.value:
                self._seed_vault_keys(workspace, users_by_email, admin_user)

            groups_by_name = self._seed_groups(workspace, users_by_email, admin_user, workspace_seed.groups)
            
            servers = self._seed_postgres_server(workspace, users_by_email, groups_by_name, admin_user)
            self._seed_laundromat_server(workspace, users_by_email, groups_by_name, admin_user, servers)
            self._seed_worksheets(workspace, users_by_email, admin_user, servers)

        return "Seeded demo workspace, users, database connections, and example worksheets."

    def _seed_vault_keys(self, workspace: Workspace, users: dict[str, User], admin_user: User) -> None:
        admin_public, admin_private = generate_user_keypair(VAULT_PASSPHRASE)
        admin_sample_payload, admin_sample_nonce = encrypt_with_public_key("hello", admin_public)
        UserKey.objects.create(
            workspace=workspace,
            user=admin_user,
            public_key=admin_public,
            private_key=admin_private,
            passphrase_hint=get_passphrase_hint(VAULT_PASSPHRASE),
            sample_payload=admin_sample_payload,
            sample_nonce=admin_sample_nonce,
            confirmed_at=timezone.now(),
            approved_at=timezone.now(),
        )

        for user in users.values():
            if user.id == admin_user.id:
                continue
            public_key, private_key = generate_user_keypair(VAULT_PASSPHRASE)
            sample_payload, sample_nonce = encrypt_with_public_key("hello", public_key)
            pending_key = UserKey.objects.create(
                workspace=workspace,
                user=user,
                public_key=public_key,
                private_key=private_key,
                passphrase_hint=get_passphrase_hint(VAULT_PASSPHRASE),
                sample_payload=sample_payload,
                sample_nonce=sample_nonce,
                confirmed_at=timezone.now(),
            )
            activate_key(
                key=pending_key,
                admin_user=admin_user,
                admin_passphrase=VAULT_PASSPHRASE,
            )

    def _seed_groups(
        self,
        workspace: Workspace,
        users: dict[str, User],
        admin_user: User,
        groups: tuple[tuple[str, str], ...],
    ) -> dict[str, UserGroup]:
        """
        Seed groups with specific membership patterns:
        - First group (Executive Circle): Admins only
        - Second group (Distribution Crew): All members except admins and two excluded users
        """
        groups_by_name = {}
        user_list = list(users.values())
        
        # Last two users excluded from groups for access control testing
        excluded_from_groups_user = user_list[-1]
        excluded_from_all_user = user_list[-2]
        
        for index, (group_name, description) in enumerate(groups):
            group = UserGroup.objects.create(
                workspace=workspace,
                name=group_name,
                description=description,
            )
            groups_by_name[group_name] = group
            
            is_admin_group = index == 0
            
            for user in users.values():
                if is_admin_group:
                    # Only admins in the first group
                    if user.role == WorkspaceRole.ADMIN.value:
                        GroupMembership.objects.create(group=group, user=user)
                else:
                    # Non-admins except excluded users in the second group
                    if (user.role != WorkspaceRole.ADMIN.value and 
                        user.id != excluded_from_groups_user.id and 
                        user.id != excluded_from_all_user.id):
                        GroupMembership.objects.create(group=group, user=user)
        
        return groups_by_name

    def _seed_postgres_server(
        self,
        workspace: Workspace,
        users: dict[str, User],
        groups_by_name: dict[str, UserGroup],
        admin_user: User,
    ) -> dict[str, Database]:
        """
        Seed Postgres database with accounts and access control:
        - Admin account: granted to admin group
        - Readonly account: granted to readonly group + direct access to excluded user
        """
        database = Database.objects.create(
            workspace=workspace,
            name="Los Pollos",
            description="Restaurant operations database",
            database_type="postgres",
            environment=DatabaseEnvironment.PRODUCTION.value,
        )

        # Neon connections always require SSL
        ssl_mode = "require"

        database_credentials = {
            "hostname": TEST_PG_HOST,
            "port": TEST_PG_PORT,
            "database": "restaurant",
            "ssl_mode": ssl_mode,
        }

        admin_passphrase = VAULT_PASSPHRASE if workspace.mode == WorkspaceMode.VAULT.value else None
        database_credential = set_database_credentials(
            database=database,
            credentials=database_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        database.database_credential = database_credential
        database.save()

        profiles = (
            ("admin", "Admin access", TEST_ADMIN_USER, TEST_ADMIN_PASS, AccountAccessLevel.ADMIN.value),
            ("readonly", "Read-only access", TEST_READ_USER, TEST_READ_PASS, AccountAccessLevel.READONLY.value),
        )

        user_list = list(users.values())
        excluded_from_groups_user = user_list[-1]
        excluded_from_all_user = user_list[-2]
        
        group_list = list(groups_by_name.values())
        admin_group = group_list[0] if len(group_list) > 0 else None
        readonly_group = group_list[1] if len(group_list) > 1 else None

        for account_name, description, username, password, access_level in profiles:
            account = DatabaseAccount.objects.create(
                database=database,
                name=account_name,
                description=description,
                permissions={},
                access_level=access_level,
            )
            account_credentials = {
                "username": username,
                "password": password,
            }
            account_credential = set_account_credentials(
                account=account,
                credentials=account_credentials,
                admin_user=admin_user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = account_credential
            account.save()
            
            if account_name == "admin" and admin_group:
                Access.objects.create(
                    workspace=workspace,
                    account=account,
                    group=admin_group,
                    mode=AccessMode.ADMIN_SET.value,
                    granted_by=admin_user,
                    granted_at=timezone.now(),
                )
            elif account_name == "readonly" and readonly_group:
                Access.objects.create(
                    workspace=workspace,
                    account=account,
                    group=readonly_group,
                    mode=AccessMode.ADMIN_SET.value,
                    granted_by=admin_user,
                    granted_at=timezone.now(),
                )
                Access.objects.create(
                    workspace=workspace,
                    account=account,
                    user=excluded_from_groups_user,
                    mode=AccessMode.ADMIN_SET.value,
                    granted_by=admin_user,
                    granted_at=timezone.now(),
                )

        return {"restaurant": database}
    
    def _seed_laundromat_server(
        self,
        workspace: Workspace,
        users: dict[str, User],
        groups_by_name: dict[str, UserGroup],
        admin_user: User,
        servers: dict[str, Database],
    ) -> None:
        """
        Seed Laundromat database with different access patterns:
        - Admin account: granted to admin only
        - Viewer account: granted to specific users (Walt and Jesse)
        """
        database = Database.objects.create(
            workspace=workspace,
            name="The Laundromat",
            description="Premium cleaning supplies distribution",
            database_type="postgres",
            environment=DatabaseEnvironment.STAGING.value,
        )

        # Neon connections always require SSL
        ssl_mode = "require"

        database_credentials = {
            "hostname": TEST_PG_HOST,
            "port": TEST_PG_PORT,
            "database": "laundromat",
            "ssl_mode": ssl_mode,
        }

        admin_passphrase = VAULT_PASSPHRASE if workspace.mode == WorkspaceMode.VAULT.value else None
        database_credential = set_database_credentials(
            database=database,
            credentials=database_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        database.database_credential = database_credential
        database.save()

        # Create accounts
        admin_account = DatabaseAccount.objects.create(
            database=database,
            name="admin",
            description="Full access to laundromat operations",
            permissions={},
            access_level=AccountAccessLevel.ADMIN.value,
        )
        admin_account_credentials = {
            "username": TEST_ADMIN_USER,
            "password": TEST_ADMIN_PASS,
        }
        admin_account_credential = set_account_credentials(
            account=admin_account,
            credentials=admin_account_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        admin_account.account_credential = admin_account_credential
        admin_account.save()
        
        viewer_account = DatabaseAccount.objects.create(
            database=database,
            name="viewer",
            description="Read-only access to product and delivery data",
            permissions={},
            access_level=AccountAccessLevel.READONLY.value,
        )
        viewer_account_credentials = {
            "username": TEST_READ_USER,
            "password": TEST_READ_PASS,
        }
        viewer_account_credential = set_account_credentials(
            account=viewer_account,
            credentials=viewer_account_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        viewer_account.account_credential = viewer_account_credential
        viewer_account.save()
        
        # Grant access: admin to Gus directly
        Access.objects.create(
            workspace=workspace,
            account=admin_account,
            user=admin_user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=admin_user,
            granted_at=timezone.now(),
        )
        
        # Grant viewer access to Walt and Jesse directly
        walt = users.get("demo+walt@vaultsql.com")
        jesse = users.get("demo+jesse@vaultsql.com")
        
        if walt:
            Access.objects.create(
                workspace=workspace,
                account=viewer_account,
                user=walt,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=admin_user,
                granted_at=timezone.now(),
            )
        
        if jesse:
            Access.objects.create(
                workspace=workspace,
                account=viewer_account,
                user=jesse,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=admin_user,
                granted_at=timezone.now(),
            )
        
        servers["laundromat"] = database

    def _seed_worksheets(
        self,
        workspace: Workspace,
        users: dict[str, User],
        admin_user: User,
        databases: dict[str, Database],
    ) -> None:
        """
        Seed example worksheets for the admin user with Breaking Bad themed queries.
        """
        restaurant_database = databases["restaurant"]
        laundromat_database = databases.get("laundromat")
        
        # Create a folder for organizing worksheets
        analytics_folder = Folder.objects.create(
            workspace=workspace,
            user=admin_user,
            database=restaurant_database,
            name="Analytics",
            position=0,
        )
        
        # Worksheet 1: Top Customers
        Worksheet.objects.create(
            workspace=workspace,
            user=admin_user,
            database=restaurant_database,
            folder=analytics_folder,
            name="Top Customers by Loyalty Points",
            position=0,
            content="""-- Top customers by loyalty points
-- Find our most loyal customers

SELECT 
    first_name || ' ' || last_name AS customer_name,
    email,
    loyalty_points,
    created_at::date AS member_since
FROM customers
ORDER BY loyalty_points DESC
LIMIT 10;""",
        )
        
        # Worksheet 2: Sales Summary
        Worksheet.objects.create(
            workspace=workspace,
            user=admin_user,
            database=restaurant_database,
            folder=analytics_folder,
            name="Recent Sales by Location",
            position=1,
            content="""-- Recent sales performance by location
-- Shows daily revenue for each restaurant

SELECT 
    location_name,
    order_date,
    total_orders,
    total_revenue,
    ROUND(total_revenue / total_orders, 2) AS avg_order_value
FROM sales_summary
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY order_date DESC, total_revenue DESC;""",
        )
        
        # Worksheet 3: Product Performance
        Worksheet.objects.create(
            workspace=workspace,
            user=admin_user,
            database=restaurant_database,
            folder=None,
            name="Best Selling Products",
            position=0,
            content="""-- Best selling products analysis
-- Shows which menu items are performing best

SELECT 
    name,
    category,
    times_ordered,
    total_quantity_sold,
    ROUND(total_revenue, 2) AS total_revenue,
    ROUND(total_revenue / NULLIF(times_ordered, 0), 2) AS avg_revenue_per_order
FROM top_products
WHERE total_revenue IS NOT NULL
LIMIT 10;""",
        )
        
        # Worksheet 4: Employee Overview
        Worksheet.objects.create(
            workspace=workspace,
            user=admin_user,
            database=restaurant_database,
            folder=None,
            name="Employee Overview",
            position=1,
            content="""-- Active employees by department
-- Overview of our workforce

SELECT 
    d.name AS department,
    COUNT(e.id) AS employee_count,
    ROUND(AVG(e.salary), 2) AS avg_salary,
    MIN(e.hire_date) AS earliest_hire
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id AND e.status = 'active'
GROUP BY d.name
ORDER BY employee_count DESC;""",
        )
        
        # Laundromat worksheets
        if laundromat_database:
            Worksheet.objects.create(
                workspace=workspace,
                user=admin_user,
                database=laundromat_database,
                folder=None,
                name="High-Value Deliveries",
                position=0,
                content="""-- High-value delivery tracking
-- Monitor premium shipments

SELECT 
    delivery_code,
    customer_account,
    total_weight_kg,
    amount,
    delivery_date,
    status,
    driver_name
FROM high_value_deliveries
ORDER BY amount DESC;""",
            )
            
            Worksheet.objects.create(
                workspace=workspace,
                user=admin_user,
                database=laundromat_database,
                folder=None,
                name="Premium Product Inventory",
                position=1,
                content="""-- High-purity product inventory
-- Track premium grade supplies

SELECT
    product_code,
    name,
    category,
    purity_grade,
    unit_price,
    storage_location
FROM inventory_status;""",
            )
