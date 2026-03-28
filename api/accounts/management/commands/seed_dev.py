from __future__ import annotations

import os
from dataclasses import dataclass

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import (
    Identity,
    MagicLink,
    PasswordResetToken,
    Session,
    User,
    Workspace,
    WorkspaceMode,
    WorkspaceRole,
)
from connection.models import Access, AccessMode, AccountAccessLevel, Database, DatabaseAccount, DatabaseTag, UserKey
from connection.utils import set_account_credentials, set_database_credentials, activate_key
from connection.crypto import generate_user_keypair, get_passphrase_hint, encrypt_with_public_key
from workspace.models import WorkspaceSettings


SEED_PASSWORD = "insecure"
SEED_EMAIL = settings.DEV_LOGIN_EMAIL
VAULT_PASSPHRASE = "crystal blue"

# Required environment variables
REQUIRED_ENV_VARS = [
    "TEST_READ_USER",
    "TEST_READ_PASS",
    "TEST_ADMIN_USER",
    "TEST_ADMIN_PASS",
    "TEST_PG_HOST",
    "TEST_PG_PORT",
    "TEST_MYSQL_HOST",
    "TEST_MYSQL_PORT",
    "TEST_SSH_HOST",
    "TEST_SSH_PORT",
    "TEST_SSH_USER",
]


def validate_env_vars() -> None:
    """Validate that all required environment variables are set."""
    missing = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
    if missing:
        raise CommandError(
            f"Missing required environment variables: {', '.join(missing)}\n"
            f"Please ensure all variables are set in env.txt"
        )


# Read from env.txt (Docker network hostnames)
TEST_READ_USER = os.getenv("TEST_READ_USER", "")
TEST_READ_PASS = os.getenv("TEST_READ_PASS", "")
TEST_ADMIN_USER = os.getenv("TEST_ADMIN_USER", "")
TEST_ADMIN_PASS = os.getenv("TEST_ADMIN_PASS", "")
TEST_PG_HOST = os.getenv("TEST_PG_HOST", "")
TEST_PG_PORT = int(os.getenv("TEST_PG_PORT", "0")) if os.getenv("TEST_PG_PORT") else 0
TEST_MYSQL_HOST = os.getenv("TEST_MYSQL_HOST", "")
TEST_MYSQL_PORT = int(os.getenv("TEST_MYSQL_PORT", "0")) if os.getenv("TEST_MYSQL_PORT") else 0
SSH_HOST = os.getenv("TEST_SSH_HOST", "")
SSH_PORT = int(os.getenv("TEST_SSH_PORT", "0")) if os.getenv("TEST_SSH_PORT") else 0
SSH_USER = os.getenv("TEST_SSH_USER", "")


def build_dev_email(suffix: str | None = None) -> str:
    if not suffix:
        return SEED_EMAIL
    return f"{settings.DEV_LOGIN_EMAIL_LOCALPART}+{suffix}@{settings.DEV_LOGIN_EMAIL_DOMAIN}"


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


WORKSPACES = (
    SeedWorkspace(
        name="Test Workspace",
        slug="test-workspace",
        mode=WorkspaceMode.VAULT.value,
        users=(
            SeedUser("Dev Admin", SEED_EMAIL, WorkspaceRole.ADMIN.value),
            SeedUser("Admin Two", build_dev_email("admin2"), WorkspaceRole.ADMIN.value),
            SeedUser("User One", build_dev_email("user1"), WorkspaceRole.MEMBER.value),
            SeedUser("User Two", build_dev_email("user2"), WorkspaceRole.MEMBER.value),
        ),
    ),
)


class Command(BaseCommand):
    help = "Seed dev data for VaultSQL workspaces, users, and connections."

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
            DatabaseAccount.objects.filter(database__workspace_id__in=workspace_ids).delete()
            Database.objects.filter(workspace_id__in=workspace_ids).delete()
            UserKey.objects.filter(workspace_id__in=workspace_ids).delete()
            Session.objects.filter(workspace_id__in=workspace_ids).delete()
            # Users are now cascade-deleted when workspace is deleted (user.workspace FK)
            workspaces.delete()

        seed_users = User.objects.filter(email__in=user_emails)
        if seed_users.exists():
            MagicLink.objects.filter(user__in=seed_users).delete()
            PasswordResetToken.objects.filter(user__in=seed_users).delete()
            seed_users.delete()

        # Delete Identity objects so passwords get reset properly
        Identity.objects.filter(email__in=user_emails).delete()

    def _seed_vault_keys(self, workspace: Workspace, users: dict[str, User], admin_user: User) -> None:
        """Create vault keys for all users with the vault passphrase."""
        # Skip vault key creation for user2 (still in onboarding)
        skip_vault_key_emails = {build_dev_email("user2")}

        # Create admin key first
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

        # Create keys for other users
        for user in users.values():
            if user.id == admin_user.id:
                continue
            if user.email in skip_vault_key_emails:
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

    def _seed_data(self) -> str:
        for workspace_seed in WORKSPACES:
            workspace = Workspace.objects.create(
                name=workspace_seed.name,
                slug=workspace_seed.slug,
                mode=workspace_seed.mode,
            )

            # Create workspace settings with gmail.com as allowed domain (only in debug mode)
            allowed_domains = [settings.DEV_LOGIN_EMAIL_DOMAIN] if os.getenv("API_DEBUG", "").lower() == "true" else []
            WorkspaceSettings.objects.create(
                workspace=workspace,
                allowed_email_domains=allowed_domains,
            )

            users_by_email = {}
            for user_seed in workspace_seed.users:
                # Create user with workspace FK and role
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

            # Create vault keys for vault mode workspaces
            if workspace.mode == WorkspaceMode.VAULT.value:
                self._seed_vault_keys(workspace, users_by_email, admin_user)

            # Seed example tags
            tags = self._seed_tags(workspace)

            # Seed servers with profiles
            self._seed_postgres_kitchen_sink(workspace, admin_user, users_by_email, tags)
            self._seed_postgres_kitchen_sink_ssh(workspace, admin_user, users_by_email, tags)
            self._seed_mysql_kitchen_sink(workspace, admin_user, users_by_email, tags)
            self._seed_mysql_kitchen_sink_ssh(workspace, admin_user, users_by_email, tags)

        return "Seeded dev workspace with 4 users and 4 databases (Postgres/MySQL, direct/SSH)."

    def _seed_tags(self, workspace: Workspace) -> dict[str, DatabaseTag]:
        """Create example tags for the workspace."""
        tag_definitions = [
            ("customer-app", "#3b82f6"),  # blue
            ("internal-tools", "#8b5cf6"),  # purple
            ("data-team", "#10b981"),  # green
            ("analytics", "#f59e0b"),  # amber
            ("spare", "#6b7280"),  # gray
            ("mirror", "#ec4899"),  # pink
            ("replica", "#06b6d4"),  # cyan
            ("archive", "#64748b"),  # slate
        ]
        
        tags = {}
        for name, color in tag_definitions:
            tag = DatabaseTag.objects.create(
                workspace=workspace,
                name=name,
                color=color,
            )
            tags[name] = tag
        
        return tags

    def _seed_postgres_kitchen_sink(self, workspace: Workspace, admin_user: User, users_by_email: dict[str, User], tags: dict[str, DatabaseTag]) -> None:
        """Seed PostgreSQL kitchen_sink database (direct connection)."""
        database = Database.objects.create(
            workspace=workspace,
            name="Postgres Kitchen Sink",
            description="PostgreSQL test database (direct)",
            database_type="postgres",
            environment="development",
        )
        database.tags.add(tags["customer-app"], tags["data-team"])

        database_credentials = {
            "hostname": TEST_PG_HOST,
            "port": TEST_PG_PORT,
            "database": "kitchen_sink",
            "ssl_mode": "prefer",
        }

        # Use vault passphrase if in vault mode
        admin_passphrase = VAULT_PASSPHRASE if workspace.mode == WorkspaceMode.VAULT.value else None

        database_credential = set_database_credentials(
            database=database,
            credentials=database_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        database.database_credential = database_credential
        database.save()

        # Create readonly and admin accounts
        for account_name, description, username, password, access_level in [
            ("readonly", "Read-only access", TEST_READ_USER, TEST_READ_PASS, AccountAccessLevel.READONLY.value),
            ("admin", "Full access", TEST_ADMIN_USER, TEST_ADMIN_PASS, AccountAccessLevel.ADMIN.value),
        ]:
            account = DatabaseAccount.objects.create(
                database=database,
                name=account_name,
                description=description,
                permissions={},
                access_level=access_level,
            )
            account_credential = set_account_credentials(
                account=account,
                credentials={"username": username, "password": password},
                admin_user=admin_user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = account_credential
            account.save()

            # Grant access to admin user
            Access.objects.create(
                workspace=workspace,
                account=account,
                user=admin_user,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=admin_user,
                granted_at=timezone.now(),
            )

    def _seed_postgres_kitchen_sink_ssh(self, workspace: Workspace, admin_user: User, users_by_email: dict[str, User], tags: dict[str, DatabaseTag]) -> None:
        """Seed PostgreSQL kitchen_sink database (via SSH bastion)."""
        database = Database.objects.create(
            workspace=workspace,
            name="Postgres Kitchen Sink (SSH)",
            description="PostgreSQL test database via SSH bastion",
            database_type="postgres",
            environment="staging",
        )
        database.tags.add(tags["customer-app"], tags["analytics"])

        database_credentials = {
            "hostname": TEST_PG_HOST,
            "port": TEST_PG_PORT,
            "database": "kitchen_sink",
            "ssl_mode": "prefer",
            "ssh_enabled": True,
            "ssh_host": SSH_HOST,
            "ssh_port": SSH_PORT,
            "ssh_user": SSH_USER,
        }

        # Use vault passphrase if in vault mode
        admin_passphrase = VAULT_PASSPHRASE if workspace.mode == WorkspaceMode.VAULT.value else None

        database_credential = set_database_credentials(
            database=database,
            credentials=database_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        database.database_credential = database_credential
        database.save()

        # Create readonly and admin profiles
        for account_name, description, username, password, access_level in [
            ("readonly", "Read-only access", TEST_READ_USER, TEST_READ_PASS, AccountAccessLevel.READONLY.value),
            ("admin", "Full access", TEST_ADMIN_USER, TEST_ADMIN_PASS, AccountAccessLevel.ADMIN.value),
        ]:
            account = DatabaseAccount.objects.create(
                database=database,
                name=account_name,
                description=description,
                permissions={},
                access_level=access_level,
            )
            account_credential = set_account_credentials(
                account=account,
                credentials={"username": username, "password": password},
                admin_user=admin_user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = account_credential
            account.save()

            # Grant access to admin user
            Access.objects.create(
                workspace=workspace,
                account=account,
                user=admin_user,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=admin_user,
                granted_at=timezone.now(),
            )

    def _seed_mysql_kitchen_sink(self, workspace: Workspace, admin_user: User, users_by_email: dict[str, User], tags: dict[str, DatabaseTag]) -> None:
        """Seed MySQL kitchen_sink database (direct connection)."""
        database = Database.objects.create(
            workspace=workspace,
            name="MySQL Kitchen Sink",
            description="MySQL test database (direct)",
            database_type="mysql",
            environment="production",
        )
        database.tags.add(tags["internal-tools"], tags["data-team"])

        database_credentials = {
            "hostname": TEST_MYSQL_HOST,
            "port": TEST_MYSQL_PORT,
            "database": "kitchen_sink",
        }

        # Use vault passphrase if in vault mode
        admin_passphrase = VAULT_PASSPHRASE if workspace.mode == WorkspaceMode.VAULT.value else None

        database_credential = set_database_credentials(
            database=database,
            credentials=database_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        database.database_credential = database_credential
        database.save()

        # Create readonly and admin accounts
        for account_name, description, username, password, access_level in [
            ("readonly", "Read-only access", TEST_READ_USER, TEST_READ_PASS, AccountAccessLevel.READONLY.value),
            ("admin", "Full access", TEST_ADMIN_USER, TEST_ADMIN_PASS, AccountAccessLevel.ADMIN.value),
        ]:
            account = DatabaseAccount.objects.create(
                database=database,
                name=account_name,
                description=description,
                permissions={},
                access_level=access_level,
            )
            account_credential = set_account_credentials(
                account=account,
                credentials={"username": username, "password": password},
                admin_user=admin_user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = account_credential
            account.save()

            # Grant access to admin user
            Access.objects.create(
                workspace=workspace,
                account=account,
                user=admin_user,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=admin_user,
                granted_at=timezone.now(),
            )

            # Grant readonly access to all test users (admin2, user1, user2)
            if account_name == "readonly":
                for email in [build_dev_email("admin2"), build_dev_email("user1"), build_dev_email("user2")]:
                    if email in users_by_email:
                        Access.objects.create(
                            workspace=workspace,
                            account=account,
                            user=users_by_email[email],
                            mode=AccessMode.ADMIN_SET.value,
                            granted_by=admin_user,
                            granted_at=timezone.now(),
                        )

    def _seed_mysql_kitchen_sink_ssh(self, workspace: Workspace, admin_user: User, users_by_email: dict[str, User], tags: dict[str, DatabaseTag]) -> None:
        """Seed MySQL kitchen_sink database (via SSH bastion)."""
        database = Database.objects.create(
            workspace=workspace,
            name="MySQL Kitchen Sink (SSH)",
            description="MySQL test database via SSH bastion",
            database_type="mysql",
            environment="testing",
        )
        database.tags.add(tags["internal-tools"], tags["replica"])

        database_credentials = {
            "hostname": TEST_MYSQL_HOST,
            "port": TEST_MYSQL_PORT,
            "database": "kitchen_sink",
            "ssh_enabled": True,
            "ssh_host": SSH_HOST,
            "ssh_port": SSH_PORT,
            "ssh_user": SSH_USER,
        }

        # Use vault passphrase if in vault mode
        admin_passphrase = VAULT_PASSPHRASE if workspace.mode == WorkspaceMode.VAULT.value else None

        database_credential = set_database_credentials(
            database=database,
            credentials=database_credentials,
            admin_user=admin_user,
            admin_passphrase=admin_passphrase,
        )
        database.database_credential = database_credential
        database.save()

        # Create readonly and admin accounts
        for account_name, description, username, password, access_level in [
            ("readonly", "Read-only access", TEST_READ_USER, TEST_READ_PASS, AccountAccessLevel.READONLY.value),
            ("admin", "Full access", TEST_ADMIN_USER, TEST_ADMIN_PASS, AccountAccessLevel.ADMIN.value),
        ]:
            account = DatabaseAccount.objects.create(
                database=database,
                name=account_name,
                description=description,
                permissions={},
                access_level=access_level,
            )
            account_credential = set_account_credentials(
                account=account,
                credentials={"username": username, "password": password},
                admin_user=admin_user,
                admin_passphrase=admin_passphrase,
            )
            account.account_credential = account_credential
            account.save()

            # Grant access to admin user
            Access.objects.create(
                workspace=workspace,
                account=account,
                user=admin_user,
                mode=AccessMode.ADMIN_SET.value,
                granted_by=admin_user,
                granted_at=timezone.now(),
            )
