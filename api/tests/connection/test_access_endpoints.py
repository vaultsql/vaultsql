import json
import pytest
from django.test import Client
from django.utils import timezone
from datetime import timedelta

from accounts.models import User, UserGroup, Workspace, WorkspaceRole
from connection.models import Access, AccessMode


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def other_user(db, managed_workspace):
    """Create another member user in managed workspace."""
    from accounts.models import WorkspaceRole
    user = User.objects.create_user(
        email="other@example.com",
        password="testpass123",
        workspace=managed_workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Other User"
    user.identity.save()
    return user


@pytest.fixture
def user_group(managed_workspace):
    return UserGroup.objects.create(
        workspace=managed_workspace,
        name="Test Group",
        description="Test group for access control",
    )


@pytest.mark.django_db
class TestAccessGrant:
    def test_grant_access_to_user(self, client, admin_session, database, database_account, other_user):
        response = client.post(
            "/api/access/grant",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
                "user_id": str(other_user.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["account_id"] == str(database_account.id)
        assert data["user_id"] == str(other_user.id)
        assert data["user_email"] == other_user.email
        assert data["mode"] == AccessMode.ADMIN_SET.value
        assert data["granted_by_id"] == str(admin_session.user.id)
        
    def test_grant_access_to_group(self, client, admin_session, database, database_account, user_group):
        response = client.post(
            "/api/access/grant",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
                "group_id": str(user_group.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["account_id"] == str(database_account.id)
        assert data["group_id"] == str(user_group.id)
        assert data["group_name"] == user_group.name
        assert data["mode"] == AccessMode.ADMIN_SET.value
        
    def test_grant_access_member_forbidden(self, client, member_session, database, database_account, other_user):
        response = client.post(
            "/api/access/grant",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
                "user_id": str(other_user.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403
        
    def test_grant_access_both_user_and_group_error(self, client, admin_session, database, database_account, other_user, user_group):
        response = client.post(
            "/api/access/grant",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
                "user_id": str(other_user.id),
                "group_id": str(user_group.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400
        
    def test_grant_access_neither_user_nor_group_error(self, client, admin_session, database, database_account):
        response = client.post(
            "/api/access/grant",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400

    def test_grant_access_user_other_workspace_error(
        self, client, admin_session, database, database_account
    ):
        other_workspace = Workspace.objects.create(
            name="Other Workspace",
            slug="other-workspace",
        )
        other_workspace_user = User.objects.create_user(
            email="outsider@example.com",
            password="testpass123",
            workspace=other_workspace,
            role=WorkspaceRole.MEMBER.value,
        )
        other_workspace_user.identity.name = "Other User"
        other_workspace_user.identity.save()

        response = client.post(
            "/api/access/grant",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
                "user_id": str(other_workspace_user.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestAccessRequest:
    def test_request_access(self, client, member_session, database, database_account):
        response = client.post(
            "/api/access/request",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["account_id"] == str(database_account.id)
        assert data["user_id"] == str(member_session.user.id)
        assert data["mode"] == AccessMode.REQUESTED.value
        assert data["requested_by_id"] == str(member_session.user.id)
        assert data["granted_at"] is None
        assert data["granted_until"] is not None
        
    def test_request_access_with_custom_timeout(self, client, member_session, database, database_account):
        response = client.post(
            "/api/access/request",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
                "timeout_hours": 6,
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["granted_until"] is not None
        
    def test_request_access_invalid_timeout(self, client, member_session, database, database_account):
        response = client.post(
            "/api/access/request",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
                "timeout_hours": 200,
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 400
        
    def test_request_access_duplicate_error(self, client, member_session, database, database_account, managed_workspace):
        # Create existing access
        Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=member_session.user,
            mode=AccessMode.REQUESTED.value,
            requested_by=member_session.user,
            requested_at=timezone.now(),
            granted_until=timezone.now() + timedelta(hours=12),
        )
        
        response = client.post(
            "/api/access/request",
            data=json.dumps({
                "database_id": str(database.id),
                "account_id": str(database_account.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestListUserAccess:
    def test_list_user_access_me(self, client, member_session, database, database_account, managed_workspace):
        # Create some access
        Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=member_session.user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=member_session.user,
            granted_at=timezone.now(),
        )
        
        response = client.get(
            "/api/access/user/me",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["user_id"] == str(member_session.user.id)
        
    def test_list_user_access_by_id(self, client, admin_session, other_user, database, database_account, managed_workspace):
        # Create some access
        Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=other_user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=admin_session.user,
            granted_at=timezone.now(),
        )
        
        response = client.get(
            f"/api/access/user/{other_user.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["user_id"] == str(other_user.id)
        
    def test_list_user_access_member_forbidden(self, client, member_session, other_user):
        response = client.get(
            f"/api/access/user/{other_user.id}",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestListAccountAccess:
    def test_list_account_access(self, client, admin_session, database, database_account, managed_workspace, other_user):
        # Create some access
        Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=other_user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=admin_session.user,
            granted_at=timezone.now(),
        )
        
        response = client.get(
            f"/api/access/account/{database.id}/{database_account.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["account_id"] == str(database_account.id)


@pytest.mark.django_db
class TestAccessRequestHistory:
    def test_list_access_request_history_admin(
        self, client, admin_session, database, database_account, managed_workspace, other_user
    ):
        # Create a pending request
        pending = Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=other_user,
            mode=AccessMode.REQUESTED.value,
            requested_by=other_user,
            requested_at=timezone.now(),
            granted_until=timezone.now() + timedelta(hours=12),
            reason="Need access for debugging",
        )
        
        # Create an approved request
        approved = Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=other_user,
            mode=AccessMode.REQUESTED.value,
            requested_by=other_user,
            requested_at=timezone.now() - timedelta(hours=2),
            granted_at=timezone.now() - timedelta(hours=1),
            granted_by=admin_session.user,
            granted_until=timezone.now() + timedelta(hours=10),
            reason="Need to review data",
        )
        
        # Create a denied request
        denied = Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=other_user,
            mode=AccessMode.REQUESTED.value,
            requested_by=other_user,
            requested_at=timezone.now() - timedelta(hours=3),
            denied_at=timezone.now() - timedelta(hours=2),
            denied_by=admin_session.user,
            reason="Testing purposes",
        )
        
        response = client.get(
            "/api/access/history",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3
        
        # Verify it's ordered by requested_at descending (most recent first)
        assert data[0]["id"] == str(pending.id)
        assert data[1]["id"] == str(approved.id)
        assert data[2]["id"] == str(denied.id)
        
        # Check pending request
        assert data[0]["status"] == "pending"
        assert data[0]["user_email"] == other_user.email
        assert data[0]["user_name"] == other_user.name
        assert data[0]["database_name"] == database.name
        assert data[0]["account_name"] == database_account.name
        assert data[0]["reason"] == "Need access for debugging"
        assert data[0]["granted_at"] is None
        assert data[0]["denied_at"] is None
        
        # Check approved request
        assert data[1]["status"] == "approved"
        assert data[1]["granted_by_name"] == admin_session.user.name
        assert data[1]["granted_by_email"] == admin_session.user.email
        assert data[1]["granted_at"] is not None
        
        # Check denied request
        assert data[2]["status"] == "denied"
        assert data[2]["denied_by_name"] == admin_session.user.name
        assert data[2]["denied_by_email"] == admin_session.user.email
        assert data[2]["denied_at"] is not None
        
    def test_list_access_request_history_member_forbidden(
        self, client, member_session
    ):
        response = client.get(
            "/api/access/history",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403
        
    def test_list_access_request_history_limit_50(
        self, client, admin_session, database, database_account, managed_workspace, other_user
    ):
        # Create 60 access requests
        for i in range(60):
            Access.objects.create(
                workspace=managed_workspace,
                account=database_account,
                user=other_user,
                mode=AccessMode.REQUESTED.value,
                requested_by=other_user,
                requested_at=timezone.now() - timedelta(hours=i),
                granted_until=timezone.now() + timedelta(hours=12),
            )
        
        response = client.get(
            "/api/access/history",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should only return 50 most recent
        assert len(data) == 50
        
    def test_list_access_request_history_expired_status(
        self, client, admin_session, database, database_account, managed_workspace, other_user
    ):
        # Create an expired request (granted but expired)
        expired = Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=other_user,
            mode=AccessMode.REQUESTED.value,
            requested_by=other_user,
            requested_at=timezone.now() - timedelta(hours=24),
            granted_at=timezone.now() - timedelta(hours=23),
            granted_by=admin_session.user,
            granted_until=timezone.now() - timedelta(hours=1),  # Expired 1 hour ago
        )
        
        response = client.get(
            "/api/access/history",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "expired"
        assert data[0]["id"] == str(expired.id)
        
    def test_list_access_request_history_revoked_status(
        self, client, admin_session, database, database_account, managed_workspace, other_user
    ):
        # Create a revoked request
        revoked = Access.objects.create(
            workspace=managed_workspace,
            account=database_account,
            user=other_user,
            mode=AccessMode.REQUESTED.value,
            requested_by=other_user,
            requested_at=timezone.now() - timedelta(hours=24),
            granted_at=timezone.now() - timedelta(hours=23),
            granted_by=admin_session.user,
            granted_until=timezone.now() + timedelta(hours=1),
            revoked_at=timezone.now() - timedelta(hours=1),
            revoked_by=admin_session.user,
        )
        
        response = client.get(
            "/api/access/history",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "revoked"
        assert data[0]["revoked_by_name"] == admin_session.user.name
        assert data[0]["revoked_by_email"] == admin_session.user.email
        assert data[0]["id"] == str(revoked.id)
