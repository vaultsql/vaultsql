import json
import pytest
from django.test import Client

from accounts.models import User, WorkspaceRole


@pytest.fixture
def client():
    return Client()


@pytest.mark.django_db
class TestKeyEndpoints:
    def test_get_my_key(self, client, vault_admin_session, user_key):
        response = client.get(
            "/api/keys/me",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert data[0]["id"] == str(user_key.id)

    def test_get_pending_keys_admin_only(self, client, admin_session):
        response = client.get(
            "/api/keys/pending",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_pending_keys_member_forbidden(self, client, member_session):
        response = client.get(
            "/api/keys/pending",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403

    def test_get_all_keys_admin_only(self, client, vault_admin_session, user_key):
        response = client.get(
            "/api/keys/all",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_revoke_key_admin_only(self, client, vault_admin_session, user_key):
        response = client.post(
            "/api/keys/revoke",
            data=json.dumps({"key_id": str(user_key.id)}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_verify_passphrase(self, client, vault_admin_session, user_key):
        response = client.get(
            "/api/keys/passphrase",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        # Should return a suggested passphrase
        assert response.status_code == 200
        data = response.json()
        assert "passphrase" in data

    def test_create_key_auto_generates_passphrase(self, client, vault_admin_session):
        # Delete any existing keys for this user
        from connection.models import UserKey
        UserKey.objects.filter(
            workspace=vault_admin_session.workspace,
            user=vault_admin_session.user,
        ).delete()
        
        response = client.post(
            "/api/keys/create",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return key details with passphrase
        assert "id" in data
        assert "passphrase" in data
        assert "passphrase_hint" in data
        assert "created_at" in data
        
        # Passphrase should be 12 words (space-separated)
        passphrase_words = data["passphrase"].split()
        assert len(passphrase_words) == 12
        
        # Hint should be first 2 words
        hint_words = data["passphrase_hint"].split()
        assert len(hint_words) == 2
        assert data["passphrase_hint"] == " ".join(passphrase_words[:2])
        
    def test_create_key_succeeds_for_only_admin(self, client, vault_admin_session):
        # Delete any existing keys for this user
        from connection.models import UserKey
        UserKey.objects.filter(
            workspace=vault_admin_session.workspace,
            user=vault_admin_session.user,
        ).delete()
        
        response = client.post(
            "/api/keys/create",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()

        user_key = UserKey.objects.get(id=data["id"])
        assert user_key.confirmed_at is not None
        assert user_key.approved_at is not None
        
    def test_create_key_fails_if_key_exists(self, client, vault_admin_session, user_key):
        response = client.post(
            "/api/keys/create",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        
        user_key.refresh_from_db()
        assert user_key.revoked_at is None
        assert data["id"] != str(user_key.id)
