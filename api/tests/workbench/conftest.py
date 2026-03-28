import secrets
from datetime import timedelta

import pytest
from django.utils import timezone

from accounts.models import Session, User, Workspace, WorkspaceMode, WorkspaceRole
from connection.models import Database, DatabaseType
from workbench.models import Folder, Worksheet, WorksheetVersion


@pytest.fixture
def workspace(db):
    """Create a workspace for testing."""
    return Workspace.objects.create(
        name="Test Workspace",
        slug="test-workspace",
        mode=WorkspaceMode.MANAGED.value,
    )


@pytest.fixture
def other_workspace(db):
    """Create another workspace for cross-workspace tests."""
    return Workspace.objects.create(
        name="Other Workspace",
        slug="other-workspace",
        mode=WorkspaceMode.MANAGED.value,
    )


@pytest.fixture
def user(workspace):
    """Create a member user."""
    user = User.objects.create_user(
        email="user@example.com",
        password="testpass123",
        workspace=workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Test User"
    user.identity.save()
    return user


@pytest.fixture
def other_user(workspace):
    """Create another user in the same workspace."""
    user = User.objects.create_user(
        email="other@example.com",
        password="testpass123",
        workspace=workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Other User"
    user.identity.save()
    return user


@pytest.fixture
def other_workspace_user(other_workspace):
    """Create a user in a different workspace."""
    user = User.objects.create_user(
        email="external@example.com",
        password="testpass123",
        workspace=other_workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "External User"
    user.identity.save()
    return user


@pytest.fixture
def user_session(user):
    """Create session for user."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=user.identity,
        user=user,
        workspace=user.workspace,
        role=user.role,
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )


@pytest.fixture
def other_user_session(other_user):
    """Create session for other user."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=other_user.identity,
        user=other_user,
        workspace=other_user.workspace,
        role=other_user.role,
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )


@pytest.fixture
def other_workspace_session(other_workspace_user):
    """Create session for user in different workspace."""
    token = secrets.token_urlsafe(32)
    return Session.objects.create(
        identity=other_workspace_user.identity,
        user=other_workspace_user,
        workspace=other_workspace_user.workspace,
        role=other_workspace_user.role,
        token=token,
        expiry=timezone.now() + timedelta(days=7),
    )


@pytest.fixture
def database(workspace):
    """Create a database in the workspace."""
    return Database.objects.create(
        workspace=workspace,
        name="Test Database",
        database_type=DatabaseType.POSTGRES.value,
    )


@pytest.fixture
def other_database(workspace):
    """Create another database in the same workspace."""
    return Database.objects.create(
        workspace=workspace,
        name="Other Database",
        database_type=DatabaseType.POSTGRES.value,
    )


@pytest.fixture
def folder(user, workspace, database):
    """Create a folder for the user on a database."""
    return Folder.objects.create(
        workspace=workspace,
        user=user,
        database=database,
        name="Test Folder",
        position=0,
    )


@pytest.fixture
def other_database_folder(user, workspace, other_database):
    """Create a folder for the user on a different database."""
    return Folder.objects.create(
        workspace=workspace,
        user=user,
        database=other_database,
        name="Other Database Folder",
        position=0,
    )


@pytest.fixture
def other_user_folder(other_user, workspace, database):
    """Create a folder for another user in the same workspace on the same database."""
    return Folder.objects.create(
        workspace=workspace,
        user=other_user,
        database=database,
        name="Other User Folder",
        position=0,
    )


@pytest.fixture
def worksheet(user, workspace, database, folder):
    """Create a worksheet for the user."""
    return Worksheet.objects.create(
        workspace=workspace,
        user=user,
        database=database,
        folder=folder,
        name="Test Worksheet",
        content="SELECT * FROM users;",
        position=0,
    )


@pytest.fixture
def root_worksheet(user, workspace, database):
    """Create a worksheet at root level (no folder)."""
    return Worksheet.objects.create(
        workspace=workspace,
        user=user,
        database=database,
        folder=None,
        name="Root Worksheet",
        content="SELECT 1;",
        position=0,
    )


@pytest.fixture
def other_database_worksheet(user, workspace, other_database):
    """Create a worksheet on a different database."""
    return Worksheet.objects.create(
        workspace=workspace,
        user=user,
        database=other_database,
        folder=None,
        name="Other Database Worksheet",
        content="SELECT 2;",
        position=0,
    )


@pytest.fixture
def other_user_worksheet(other_user, workspace, database, other_user_folder):
    """Create a worksheet for another user."""
    return Worksheet.objects.create(
        workspace=workspace,
        user=other_user,
        database=database,
        folder=other_user_folder,
        name="Other User Worksheet",
        content="SELECT * FROM secrets;",
        position=0,
    )
