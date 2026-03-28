import secrets
from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.models import Session, User, Workspace, WorkspaceMode, WorkspaceRole
from connection.models import Database, DatabaseAccount, UserKey


@pytest.fixture
def managed_workspace(db):
    """Create managed workspace first (users depend on it)."""
    return Workspace.objects.create(
        name="Managed Workspace",
        slug="managed-workspace",
        mode=WorkspaceMode.MANAGED.value,
    )


@pytest.fixture
def vault_workspace(db):
    """Create vault workspace first (users depend on it)."""
    return Workspace.objects.create(
        name="Vault Workspace",
        slug="vault-workspace",
        mode=WorkspaceMode.VAULT.value,
    )


@pytest.fixture
def user(managed_workspace):
    """Create member user in managed workspace."""
    user = User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        workspace=managed_workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Test User"
    user.identity.save()
    return user


@pytest.fixture
def admin_user(managed_workspace):
    """Create admin user in managed workspace."""
    user = User.objects.create_user(
        email="admin@example.com",
        password="adminpass123",
        workspace=managed_workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Admin User"
    user.identity.save()
    return user


@pytest.fixture
def admin_session(admin_user, managed_workspace):
    """Create session for admin user."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=admin_user.identity,
        user=admin_user,
        workspace=admin_user.workspace,  # Denormalized from user
        role=admin_user.role,  # Denormalized from user
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )


@pytest.fixture
def member_session(user, managed_workspace):
    """Create session for member user."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=user.identity,
        user=user,
        workspace=user.workspace,  # Denormalized from user
        role=user.role,  # Denormalized from user
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )


@pytest.fixture
def vault_admin_user(vault_workspace):
    """Create admin user in vault workspace."""
    user = User.objects.create_user(
        email="vaultadmin@example.com",
        password="vaultpass123",
        workspace=vault_workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Vault Admin"
    user.identity.save()
    return user


@pytest.fixture
def vault_admin_session(vault_admin_user, vault_workspace):
    """Create session for vault admin."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=vault_admin_user.identity,
        user=vault_admin_user,
        workspace=vault_workspace,
        role=WorkspaceRole.ADMIN.value,
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )


@pytest.fixture
def database(managed_workspace):
    return Database.objects.create(
        workspace=managed_workspace,
        name="Test PostgreSQL Database",
        database_type="postgres",
        description="Test database",
    )


@pytest.fixture
def database_account(database):
    return DatabaseAccount.objects.create(
        database=database,
        name="Test Account",
        description="Test account",
    )


@pytest.fixture
def user_key(vault_admin_user, vault_workspace):
    """Create user key for vault admin user."""
    return UserKey.objects.create(
        user=vault_admin_user,
        workspace=vault_workspace,
        public_key="fake_public_key",
        private_key="fake_encrypted_private_key",
        passphrase_hint="test hint",
    )
