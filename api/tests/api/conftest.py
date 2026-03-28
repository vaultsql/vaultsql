import secrets
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from accounts.models import Session, User, Workspace, WorkspaceRole


@pytest.fixture
def workspace(db):
    """Create workspace first (users depend on it)."""
    return Workspace.objects.create(
        name="Test Workspace",
        slug="test-workspace",
    )


@pytest.fixture
def another_workspace(db):
    """Create second workspace for multi-workspace tests."""
    return Workspace.objects.create(
        name="Second Workspace",
        slug="second-workspace",
    )


@pytest.fixture
def user(workspace):
    """Create admin user in test workspace."""
    user = User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        workspace=workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Test User"
    user.identity.save()
    return user


@pytest.fixture
def member_user(workspace):
    """Create member user in test workspace."""
    user = User.objects.create_user(
        email="member@example.com",
        password="testpass123",
        workspace=workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Member User"
    user.identity.save()
    return user


@pytest.fixture
def session(user, workspace):
    """Create session for admin user."""
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
def another_user(another_workspace):
    """Create user in second workspace."""
    user = User.objects.create_user(
        email="another@example.com",
        password="testpass123",
        workspace=another_workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Another User"
    user.identity.save()
    return user


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def vault_workspace(db):
    """Create vault mode workspace for passphrase tests."""
    from accounts.models import WorkspaceMode
    return Workspace.objects.create(
        name="Vault Test Workspace",
        slug="vault-test-workspace",
        mode=WorkspaceMode.VAULT.value,
    )


@pytest.fixture
def vault_user(vault_workspace):
    """Create user in vault workspace."""
    user = User.objects.create_user(
        email="vaultuser@example.com",
        password="testpass123",
        workspace=vault_workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Vault User"
    user.identity.save()
    return user


@pytest.fixture
def vault_passphrase():
    """Standard passphrase for vault tests."""
    return "test-passphrase-eight-words-here-for-testing-purpose"


@pytest.fixture
def vault_user_key(vault_user, vault_workspace, vault_passphrase):
    """Create confirmed user key with sample payload for passphrase testing."""
    from connection.models import UserKey
    from connection.crypto import generate_user_keypair, encrypt_with_public_key
    
    public_pem, private_pem = generate_user_keypair(vault_passphrase)
    sample_encrypted, sample_nonce = encrypt_with_public_key("hello", public_pem)
    
    return UserKey.objects.create(
        user=vault_user,
        workspace=vault_workspace,
        public_key=public_pem,
        private_key=private_pem,
        passphrase_hint="test hint",
        sample_payload=sample_encrypted,
        sample_nonce=sample_nonce,
        confirmed_at=timezone.now(),
    )


@pytest.fixture
def vault_session(vault_user, vault_workspace):
    """Create session for vault user."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=vault_user.identity,
        user=vault_user,
        workspace=vault_workspace,
        role=vault_user.role,
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )
