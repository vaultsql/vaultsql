import json
import secrets
from datetime import timedelta
import pytest
from django.utils import timezone
from accounts.models import Identity, Session, User, Workspace, WorkspaceMode, WorkspaceRole


@pytest.mark.django_db
class TestHealthEndpoint:
    def test_health_endpoint(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


@pytest.mark.django_db
class TestAuthEndpoints:
    def test_login_creates_workspace_session(self, client, user, workspace):
        response = client.post(
            "/api/auth/login",
            data=json.dumps({"email": "test@example.com", "password": "testpass123"}),
            content_type="application/json",
        )
        assert response.status_code == 200

        data = response.json()
        assert "token" in data
        assert "identity" in data
        assert data["identity"]["email"] == "test@example.com"
        assert data["needs_onboarding"] is False

        token = data["token"]
        session = Session.objects.get(token=token)
        assert session.identity == user.identity
        assert session.user_id == user.id
        assert session.workspace_id == user.workspace_id
        assert session.role == user.role


@pytest.mark.django_db
class TestUserMeEndpoint:
    def test_me_endpoint_success(self, client, user, workspace, session):
        response = client.get(
            "/api/user/me",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["session_type"] == "workspace"
        assert data["user"]["email"] == "test@example.com"
        assert data["workspace"]["name"] == "Test Workspace"
        assert "flags" in data
        assert "is_solo_admin" in data["flags"]
    
    def test_me_endpoint_no_auth(self, client):
        response = client.get("/api/user/me")
        assert response.status_code == 401

    def test_me_endpoint_identity_session_rejected(self, client, user):
        identity_session = Session.objects.create(
            identity=user.identity,
            token=secrets.token_urlsafe(32),
            expiry=timezone.now() + timedelta(days=7),
        )
        response = client.get(
            "/api/user/me",
            HTTP_AUTHORIZATION=f"Bearer {identity_session.token}"
        )
        assert response.status_code == 401
    
    def test_me_endpoint_flags_managed_mode(self, client, user, workspace, session):
        """In managed mode, flags should be False."""
        response = client.get(
            "/api/user/me",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["key"] is None


@pytest.mark.django_db
class TestIdentityMeEndpoint:
    def test_identity_me_no_workspaces(self, client, db):
        identity = Identity.objects.create(email="identity@example.com")
        identity.set_password("testpass123")
        identity.save()
        session = Session.objects.create(
            identity=identity,
            token=secrets.token_urlsafe(32),
            expiry=timezone.now() + timedelta(days=7),
        )

        response = client.get(
            "/api/identity/me",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_type"] == "identity"
        assert data["identity"]["email"] == "identity@example.com"
        assert data["workspaces"] == []

    def test_identity_me_includes_workspaces(self, client, user):
        session = Session.objects.create(
            identity=user.identity,
            token=secrets.token_urlsafe(32),
            expiry=timezone.now() + timedelta(days=7),
        )

        response = client.get(
            "/api/identity/me",
            HTTP_AUTHORIZATION=f"Bearer {session.token}"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["workspaces"]) == 1
        assert data["workspaces"][0]["slug"] == "test-workspace"
        assert data["workspaces"][0]["role"] == "admin"

    def test_identity_me_no_auth(self, client):
        response = client.get("/api/identity/me")
        assert response.status_code == 401
    
    def test_me_endpoint_flags_vault_mode_needs_key_create(self, client, db):
        """In vault mode without a key, key should be None."""
        # Create vault workspace and user
        vault_workspace = Workspace.objects.create(
            name="Vault Workspace",
            slug="vault-workspace",
            mode=WorkspaceMode.VAULT.value,
        )
        vault_user = User.objects.create_user(
            email="vault@example.com",
            password="testpass123",
            workspace=vault_workspace,
            role=WorkspaceRole.ADMIN.value,
        )
        vault_user.identity.name = "Vault User"
        vault_user.identity.save()
        vault_session = Session.objects.create(
            identity=vault_user.identity,
            user=vault_user,
            workspace=vault_workspace,
            role=vault_user.role,
            token=secrets.token_urlsafe(32),
            expiry=timezone.now() + timedelta(days=7),
        )
        
        response = client.get(
            "/api/user/me",
            HTTP_AUTHORIZATION=f"Bearer {vault_session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["key"] is None
    
    def test_me_endpoint_flags_vault_mode_needs_key_approval(self, client, db):
        """In vault mode with unapproved key, key.approved_at should be None."""
        from connection.models import UserKey
        
        # Create vault workspace and user
        vault_workspace = Workspace.objects.create(
            name="Vault Workspace 2",
            slug="vault-workspace-2",
            mode=WorkspaceMode.VAULT.value,
        )
        vault_user = User.objects.create_user(
            email="vault2@example.com",
            password="testpass123",
            workspace=vault_workspace,
            role=WorkspaceRole.ADMIN.value,
        )
        vault_user.identity.name = "Vault User"
        vault_user.identity.save()
        
        # Create unapproved key
        UserKey.objects.create(
            workspace=vault_workspace,
            user=vault_user,
            public_key="fake_public_key",
            private_key="fake_private_key",
            passphrase_hint="test hint",
            confirmed_at=timezone.now(),
        )
        
        vault_session = Session.objects.create(
            identity=vault_user.identity,
            user=vault_user,
            workspace=vault_workspace,
            role=vault_user.role,
            token=secrets.token_urlsafe(32),
            expiry=timezone.now() + timedelta(days=7),
        )
        
        response = client.get(
            "/api/user/me",
            HTTP_AUTHORIZATION=f"Bearer {vault_session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["key"] is not None
        assert data["key"]["approved_at"] is None
    
    def test_me_endpoint_flags_vault_mode_key_approved(self, client, db):
        """In vault mode with approved key, key.approved_at should be set."""
        from connection.models import UserKey
        
        # Create vault workspace and user
        vault_workspace = Workspace.objects.create(
            name="Vault Workspace 3",
            slug="vault-workspace-3",
            mode=WorkspaceMode.VAULT.value,
        )
        vault_user = User.objects.create_user(
            email="vault3@example.com",
            password="testpass123",
            workspace=vault_workspace,
            role=WorkspaceRole.ADMIN.value,
        )
        vault_user.identity.name = "Vault User"
        vault_user.identity.save()
        
        # Create approved key
        UserKey.objects.create(
            workspace=vault_workspace,
            user=vault_user,
            public_key="fake_public_key",
            private_key="fake_private_key",
            passphrase_hint="test hint",
            confirmed_at=timezone.now(),
            approved_at=timezone.now(),
        )
        
        vault_session = Session.objects.create(
            identity=vault_user.identity,
            user=vault_user,
            workspace=vault_workspace,
            role=vault_user.role,
            token=secrets.token_urlsafe(32),
            expiry=timezone.now() + timedelta(days=7),
        )
        
        response = client.get(
            "/api/user/me",
            HTTP_AUTHORIZATION=f"Bearer {vault_session.token}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["key"] is not None
        assert data["key"]["approved_at"] is not None


@pytest.mark.django_db
class TestPassphraseEndpoint:
    def test_passphrase_test_success(self, client, vault_user_key, vault_session, vault_passphrase):
        """Test correct passphrase returns success"""
        response = client.post(
            "/api/user/test-passphrase",
            data=json.dumps({"passphrase": vault_passphrase}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
    
    def test_passphrase_test_wrong_passphrase(self, client, vault_user_key, vault_session):
        """Test incorrect passphrase returns failure"""
        response = client.post(
            "/api/user/test-passphrase",
            data=json.dumps({"passphrase": "wrong-passphrase-words-here"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
    
    def test_passphrase_test_no_key(self, client, user, workspace, session):
        """Test user with no key returns failure"""
        response = client.post(
            "/api/user/test-passphrase",
            data=json.dumps({"passphrase": "any-passphrase"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
    
    def test_passphrase_test_revoked_key(self, client, vault_user_key, vault_session, vault_passphrase):
        """Test revoked key returns failure"""
        # Revoke the key
        vault_user_key.revoked_at = timezone.now()
        vault_user_key.save()
        
        # Test with correct passphrase but revoked key
        response = client.post(
            "/api/user/test-passphrase",
            data=json.dumps({"passphrase": vault_passphrase}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False


# V1: Users belong to exactly one workspace, so switch-workspace endpoint is removed
# @pytest.mark.django_db
# class TestSwitchWorkspaceEndpoint:
#     def test_switch_workspace_updates_session_role(
#         self, client, session, another_workspace, another_user
#     ):
#         response = client.post(
#             "/api/user/switch-workspace",
#             data=json.dumps({"workspace_id": str(another_workspace.id)}),
#             content_type="application/json",
#             HTTP_AUTHORIZATION=f"Bearer {session.token}",
#         )
#         assert response.status_code == 200
#
#         data = response.json()
#         assert data["workspace"]["role"] == WorkspaceRole.MEMBER.value
#
#         session.refresh_from_db()
#         assert str(session.workspace_id) == str(another_workspace.id)
#         assert session.role == WorkspaceRole.MEMBER.value
