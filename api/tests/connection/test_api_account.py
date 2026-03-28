import json
import pytest
from unittest.mock import MagicMock, patch
from django.test import Client
from django.utils import timezone

from connection.models import Access, AccessMode
from connection.utils import set_database_credentials, set_account_credentials
from connection.crypto import generate_user_keypair

@pytest.fixture
def client():
    return Client()

@pytest.fixture
def vault_database(vault_workspace):
    from connection.models import Database, DatabaseType
    return Database.objects.create(
        workspace=vault_workspace,
        name="Vault Test Database",
        database_type=DatabaseType.POSTGRES.value,
    )

@pytest.fixture
def admin_passphrase():
    return "apple brave cloud delta eagle frost green happy"

@pytest.fixture
def admin_key(vault_admin_user, vault_workspace, admin_passphrase):
    from connection.crypto import generate_user_keypair
    from connection.models import UserKey
    public_key, private_key = generate_user_keypair(admin_passphrase)
    return UserKey.objects.create(
        workspace=vault_workspace,
        user=vault_admin_user,
        public_key=public_key,
        private_key=private_key,
        confirmed_at=timezone.now(),
        approved_at=timezone.now(),
    )

@pytest.mark.django_db
class TestApiAccount:
    def test_get_keys_vault_mode_success(self, client, vault_admin_session, vault_database, vault_admin_user, admin_passphrase, admin_key):
        # Setup vault mode database account
        account = vault_database.accounts.create(name="Vault Account")
        
        # Set credentials
        set_database_credentials(vault_database, {"host": "vault-host"}, vault_admin_user, admin_passphrase)
        set_account_credentials(account, {"user": "vault-user"}, vault_admin_user, admin_passphrase)
        
        vault_database.database_credential = vault_database.workspace.credentials.all()[0]
        vault_database.save()
        account.account_credential = vault_database.workspace.credentials.all()[1]
        account.save()

        # Grant access
        Access.objects.create(
            workspace=vault_database.workspace,
            account=account,
            user=vault_admin_user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=vault_admin_user,
            granted_at=timezone.now(),
        )

        # Get keys with correct passphrase
        response = client.post(
            f"/api/account/{account.id}/keys",
            data=json.dumps({
                "passphrase": admin_passphrase,
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )

        assert response.status_code == 200
        data = response.json()
        assert "database_key" in data
        assert "account_key" in data
        assert data["database_key"]["host"] == "vault-host"
        assert data["account_key"]["user"] == "vault-user"

    def test_get_keys_vault_mode_wrong_passphrase(self, client, vault_admin_session, vault_database, vault_admin_user, admin_passphrase, admin_key):
        # Setup vault mode database account
        account = vault_database.accounts.create(name="Vault Account")
        
        # Set credentials
        set_database_credentials(vault_database, {"host": "vault-host"}, vault_admin_user, admin_passphrase)
        set_account_credentials(account, {"user": "vault-user"}, vault_admin_user, admin_passphrase)
        
        vault_database.database_credential = vault_database.workspace.credentials.all()[0]
        vault_database.save()
        account.account_credential = vault_database.workspace.credentials.all()[1]
        account.save()

        # Grant access
        Access.objects.create(
            workspace=vault_database.workspace,
            account=account,
            user=vault_admin_user,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=vault_admin_user,
            granted_at=timezone.now(),
        )

        # Try with WRONG passphrase
        response = client.post(
            f"/api/account/{account.id}/keys",
            data=json.dumps({
                "passphrase": "wrong-passphrase",
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )

        assert response.status_code == 400
        # The error comes from decrypt_with_private_key which raises an exception when decryption fails
        detail = response.json()["detail"]
        assert "Incorrect password" in detail or "Ciphertext authentication failed" in detail
