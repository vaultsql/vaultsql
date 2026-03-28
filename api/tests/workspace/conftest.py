import secrets
from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.models import Session, User, Workspace, WorkspaceMode, WorkspaceRole
from workspace.models import WorkspaceSettings


@pytest.fixture
def workspace(db):
    """Create a workspace for testing."""
    return Workspace.objects.create(
        name="Test Workspace",
        slug="test-workspace",
        mode=WorkspaceMode.MANAGED.value,
    )


@pytest.fixture
def workspace_settings(workspace):
    """Create workspace settings."""
    return WorkspaceSettings.objects.create(
        workspace=workspace,
        audit_store_queries=False,
    )


@pytest.fixture
def workspace_settings_with_query_storage(workspace):
    """Create workspace settings with query storage enabled."""
    settings, _ = WorkspaceSettings.objects.get_or_create(
        workspace=workspace,
        defaults={"audit_store_queries": True},
    )
    settings.audit_store_queries = True
    settings.save()
    return settings


@pytest.fixture
def workspace_settings_audit_disabled(workspace):
    """Create workspace settings with audit logging disabled."""
    settings, _ = WorkspaceSettings.objects.get_or_create(
        workspace=workspace,
        defaults={"audit_enabled": False},
    )
    settings.audit_enabled = False
    settings.save()
    return settings


@pytest.fixture
def admin_user(workspace):
    """Create an admin user."""
    user = User.objects.create_user(
        email="admin@example.com",
        password="testpass123",
        workspace=workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Admin User"
    user.identity.save()
    return user


@pytest.fixture
def member_user(workspace):
    """Create a member user."""
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
def admin_session(admin_user):
    """Create session for admin user."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=admin_user.identity,
        user=admin_user,
        workspace=admin_user.workspace,
        role=admin_user.role,
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )


@pytest.fixture
def member_session(member_user):
    """Create session for member user."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=member_user.identity,
        user=member_user,
        workspace=member_user.workspace,
        role=member_user.role,
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )
