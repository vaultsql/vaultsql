"""
Tests for audit log functionality.
"""
import csv
import io
import json

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from connection.models import Access, AccessMode, Database, DatabaseAccount, DatabaseType
from workspace.audit import create_query_audit_log, create_system_audit_log, is_audit_enabled
from workspace.models import AuditLog, WorkspaceSettings
from workspace.types import AuditEventType, AuditActorType, QueryActorType


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def database(workspace):
    return Database.objects.create(
        workspace=workspace,
        name="Test Database",
        database_type=DatabaseType.POSTGRES.value,
    )


@pytest.fixture
def database_account(database):
    return DatabaseAccount.objects.create(
        database=database,
        name="Test Account",
    )


# ============ Model Tests ============

@pytest.mark.django_db
class TestAuditLogModel:
    def test_create_audit_log_directly(self, workspace, admin_user):
        """Can create audit log entry via model."""
        log = AuditLog.objects.create(
            workspace=workspace,
            actor_type=AuditActorType.USER.value,
            actor_id=admin_user.id,
            actor_email=admin_user.email,
            event_type=AuditEventType.QUERY_EXECUTE.value,
            query_actor_type=QueryActorType.CUSTOM.value,
            query_hash="abc123",
            database="test_db",
        )
        
        assert log.id is not None
        assert log.workspace == workspace
        assert log.actor_type == AuditActorType.USER.value
        assert log.actor_email == admin_user.email
        assert log.event_type == AuditEventType.QUERY_EXECUTE.value
        assert log.query_actor_type == QueryActorType.CUSTOM.value

    def test_audit_log_ordering(self, workspace, admin_user):
        """Audit logs are ordered by created_at descending."""
        log1 = AuditLog.objects.create(
            workspace=workspace,
            actor_type=AuditActorType.USER.value,
            event_type=AuditEventType.QUERY_EXECUTE.value,
        )
        log2 = AuditLog.objects.create(
            workspace=workspace,
            actor_type=AuditActorType.USER.value,
            event_type=AuditEventType.QUERY_EXECUTE.value,
        )
        
        logs = list(AuditLog.objects.filter(workspace=workspace))
        assert logs[0] == log2  # Most recent first
        assert logs[1] == log1


# ============ Utility Function Tests ============

@pytest.mark.django_db
class TestAuditUtilities:
    def test_create_query_audit_log(self, workspace, admin_user, workspace_settings):
        """create_query_audit_log creates proper entry."""
        log = create_query_audit_log(
            workspace=workspace,
            user=admin_user,
            event_type=AuditEventType.QUERY_EXECUTE,
            query_actor_type=QueryActorType.CUSTOM,
            query_text="SELECT * FROM users",
            database="app_db",
        )
        
        assert log is not None
        assert log.workspace == workspace
        assert log.actor_type == AuditActorType.USER.value
        assert log.actor_id == admin_user.id
        assert log.actor_email == admin_user.email
        assert log.event_type == AuditEventType.QUERY_EXECUTE.value
        assert log.query_actor_type == QueryActorType.CUSTOM.value
        assert log.query_hash is not None
        assert len(log.query_hash) == 64  # SHA256
        assert log.query_text is None  # Not stored by default
        assert log.database == "app_db"

    def test_create_query_audit_log_returns_none_when_disabled(
        self, workspace, admin_user, workspace_settings_audit_disabled
    ):
        """create_query_audit_log returns None when audit is disabled."""
        log = create_query_audit_log(
            workspace=workspace,
            user=admin_user,
            event_type=AuditEventType.QUERY_EXECUTE,
            query_actor_type=QueryActorType.CUSTOM,
            query_text="SELECT * FROM users",
        )
        
        assert log is None

    def test_create_query_audit_log_with_query_storage(
        self, workspace, admin_user, workspace_settings_with_query_storage
    ):
        """Query text is stored when workspace opts in."""
        query = "SELECT * FROM secrets"
        log = create_query_audit_log(
            workspace=workspace,
            user=admin_user,
            event_type=AuditEventType.QUERY_EXECUTE,
            query_actor_type=QueryActorType.CUSTOM,
            query_text=query,
        )
        
        assert log.query_text == query

    def test_create_query_audit_log_without_settings(self, workspace, admin_user):
        """Query text not stored when no settings exist."""
        # Delete any existing settings
        WorkspaceSettings.objects.filter(workspace=workspace).delete()
        
        log = create_query_audit_log(
            workspace=workspace,
            user=admin_user,
            event_type=AuditEventType.QUERY_EXECUTE,
            query_actor_type=QueryActorType.USER,
            query_text="CREATE TABLE test (id INT)",
        )
        
        assert log.query_text is None

    def test_create_system_audit_log(self, workspace, workspace_settings):
        """create_system_audit_log creates proper entry."""
        log = create_system_audit_log(
            workspace=workspace,
            event_type=AuditEventType.QUERY_CANCEL,
            metadata={"reason": "timeout"},
        )
        
        assert log is not None
        assert log.actor_type == AuditActorType.SYSTEM.value
        assert log.actor_id is None
        assert log.actor_email is None
        assert log.metadata == {"reason": "timeout"}

    def test_create_system_audit_log_returns_none_when_disabled(
        self, workspace, workspace_settings_audit_disabled
    ):
        """create_system_audit_log returns None when audit is disabled."""
        log = create_system_audit_log(
            workspace=workspace,
            event_type=AuditEventType.QUERY_CANCEL,
        )
        
        assert log is None

    def test_create_user_audit_log_returns_none_when_disabled(
        self, workspace, admin_user, workspace_settings_audit_disabled
    ):
        """create_user_audit_log returns None when audit is disabled."""
        from workspace.audit import create_user_audit_log
        
        log = create_user_audit_log(
            workspace=workspace,
            user=admin_user,
            event_type=AuditEventType.USER_JOINED,
        )
        
        assert log is None

    def test_query_hash_is_deterministic(self, workspace, admin_user, workspace_settings):
        """Same query produces same hash."""
        query = "SELECT 1"
        log1 = create_query_audit_log(
            workspace=workspace,
            user=admin_user,
            event_type=AuditEventType.QUERY_EXECUTE,
            query_actor_type=QueryActorType.APPLICATION,
            query_text=query,
        )
        log2 = create_query_audit_log(
            workspace=workspace,
            user=admin_user,
            event_type=AuditEventType.QUERY_EXECUTE,
            query_actor_type=QueryActorType.APPLICATION,
            query_text=query,
        )
        
        assert log1.query_hash == log2.query_hash


# ============ API Endpoint Tests ============

@pytest.mark.django_db
class TestAuditDownloadEndpoint:
    def test_admin_can_download_csv(self, client, admin_session, workspace):
        """Admin can download audit log CSV."""
        # Create some audit logs
        AuditLog.objects.create(
            workspace=workspace,
            actor_type=AuditActorType.USER.value,
            actor_email="test@example.com",
            event_type=AuditEventType.QUERY_EXECUTE.value,
            query_actor_type=QueryActorType.CUSTOM.value,
            query_hash="abc123",
            database="test_db",
        )
        
        response = client.get(
            "/api/audit/audit-log/download",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        
        assert response.status_code == 200
        assert response["Content-Type"] == "text/csv"
        assert "attachment" in response["Content-Disposition"]

    def test_csv_has_expected_columns(self, client, admin_session, workspace):
        """CSV contains all expected columns."""
        AuditLog.objects.create(
            workspace=workspace,
            actor_type=AuditActorType.USER.value,
            actor_email="test@example.com",
            event_type=AuditEventType.QUERY_EXECUTE.value,
        )
        
        response = client.get(
            "/api/audit/audit-log/download",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        
        content = response.content.decode("utf-8")
        reader = csv.reader(io.StringIO(content))
        headers = next(reader)
        
        expected_headers = [
            "timestamp",
            "actor_type",
            "actor_email",
            "event_type",
            "database_name",
            "query_actor_type",
            "query_hash",
            "query_text",
            "database",
            "metadata",
        ]
        assert headers == expected_headers

    def test_member_cannot_download(self, client, member_session):
        """Non-admin gets 403."""
        response = client.get(
            "/api/audit/audit-log/download",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        
        assert response.status_code == 403

    def test_unauthenticated_cannot_download(self, client):
        """Unauthenticated request gets 401."""
        response = client.get("/api/audit/audit-log/download")
        assert response.status_code == 401

    def test_download_with_date_filter(self, client, admin_session, workspace):
        """Can filter by date range."""
        AuditLog.objects.create(
            workspace=workspace,
            actor_type=AuditActorType.USER.value,
            event_type=AuditEventType.QUERY_EXECUTE.value,
        )
        
        response = client.get(
            "/api/audit/audit-log/download?start_date=2020-01-01&end_date=2030-12-31",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        
        assert response.status_code == 200

    def test_empty_audit_log_returns_headers_only(self, client, admin_session):
        """Empty audit log returns CSV with headers only."""
        response = client.get(
            "/api/audit/audit-log/download",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        
        assert response.status_code == 200
        content = response.content.decode("utf-8")
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        
        assert len(rows) == 1  # Headers only


# ============ WorkspaceSettings Tests ============

@pytest.mark.django_db
class TestWorkspaceSettings:
    def test_create_workspace_settings(self, workspace):
        """Can create workspace settings."""
        settings = WorkspaceSettings.objects.create(
            workspace=workspace,
            audit_store_queries=True,
        )
        
        assert settings.workspace == workspace
        assert settings.audit_store_queries is True

    def test_default_audit_store_queries_is_false(self, workspace):
        """audit_store_queries defaults to False."""
        settings = WorkspaceSettings.objects.create(workspace=workspace)
        assert settings.audit_store_queries is False

    def test_workspace_settings_one_to_one(self, workspace):
        """Only one settings per workspace."""
        WorkspaceSettings.objects.create(workspace=workspace)
        
        with pytest.raises(Exception):  # IntegrityError
            WorkspaceSettings.objects.create(workspace=workspace)


# ============ Log Endpoint Tests ============

@pytest.mark.django_db
class TestLogEndpoint:
    """Tests for POST /api/account/{account_id}/log endpoint."""

    @override_settings(QUERY_SERVICE_SECRET="test-secret")
    def test_log_creates_audit_entry(self, client, member_session, database_account, member_user, workspace):
        """Log endpoint creates audit log entry."""
        Access.objects.create(
            workspace=workspace,
            account=database_account,
            user=member_user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=member_user,
            granted_at=timezone.now(),
        )
        
        response = client.post(
            f"/api/account/{database_account.id}/log",
            data=json.dumps({
                "query": "SELECT * FROM users",
                "query_actor_type": "custom",
                "database": "test_db",
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
            HTTP_X_QUERY_SECRET="test-secret",
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        log = AuditLog.objects.filter(workspace=workspace).first()
        assert log is not None
        assert log.query_actor_type == "custom"

    @override_settings(QUERY_SERVICE_SECRET="test-secret")
    def test_log_requires_query_secret(self, client, member_session, database_account):
        """Log endpoint requires X-Query-Secret header."""
        response = client.post(
            f"/api/account/{database_account.id}/log",
            data=json.dumps({"query": "SELECT 1", "query_actor_type": "custom"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403

    def test_log_requires_authentication(self, client, database_account):
        """Log endpoint requires authentication."""
        response = client.post(
            f"/api/account/{database_account.id}/log",
            data=json.dumps({"query": "SELECT 1", "query_actor_type": "custom"}),
            content_type="application/json",
        )
        assert response.status_code == 401

    @override_settings(QUERY_SERVICE_SECRET="test-secret")
    def test_log_skipped_when_audit_disabled(self, client, member_session, database_account, member_user, workspace):
        """Log endpoint returns success but does not create entry when audit disabled."""
        Access.objects.create(
            workspace=workspace,
            account=database_account,
            user=member_user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=member_user,
            granted_at=timezone.now(),
        )
        
        # Disable audit logging
        settings, _ = WorkspaceSettings.objects.get_or_create(workspace=workspace)
        settings.audit_enabled = False
        settings.save()
        
        initial_count = AuditLog.objects.filter(workspace=workspace).count()
        
        response = client.post(
            f"/api/account/{database_account.id}/log",
            data=json.dumps({
                "query": "SELECT * FROM users",
                "query_actor_type": "custom",
                "database": "test_db",
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
            HTTP_X_QUERY_SECRET="test-secret",
        )
        
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # No new audit log should be created
        assert AuditLog.objects.filter(workspace=workspace).count() == initial_count


# ============ is_audit_enabled Tests ============

@pytest.mark.django_db
class TestIsAuditEnabled:
    def test_audit_enabled_by_default(self, workspace):
        """Audit is enabled by default when no settings exist."""
        WorkspaceSettings.objects.filter(workspace=workspace).delete()
        assert is_audit_enabled(workspace) is True

    def test_audit_enabled_when_setting_true(self, workspace):
        """Audit is enabled when setting is True."""
        WorkspaceSettings.objects.get_or_create(
            workspace=workspace,
            defaults={"audit_enabled": True}
        )
        settings = WorkspaceSettings.objects.get(workspace=workspace)
        settings.audit_enabled = True
        settings.save()
        assert is_audit_enabled(workspace) is True

    def test_audit_disabled_when_setting_false(self, workspace):
        """Audit is disabled when setting is False."""
        settings, _ = WorkspaceSettings.objects.get_or_create(workspace=workspace)
        settings.audit_enabled = False
        settings.save()
        assert is_audit_enabled(workspace) is False
