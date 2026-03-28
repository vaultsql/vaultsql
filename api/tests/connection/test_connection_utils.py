import pytest
from django.core.exceptions import ValidationError
from datetime import timedelta
from django.utils import timezone

from accounts.models import User, Workspace, WorkspaceMode, WorkspaceRole, UserGroup, GroupMembership
from connection.models import (
    Database, DatabaseAccount, Credential, UserCredential, UserKey,
    EncryptionAlgorithm, DatabaseType, Access, AccessMode,
)
from connection.crypto import generate_user_keypair
from connection.utils import (
    set_database_credentials,
    set_account_credentials,
    activate_key,
    get_credentials,
    get_accessible_accounts,
)


@pytest.fixture
def managed_workspace(db):
    return Workspace.objects.create(
        name="Managed Workspace",
        slug="managed-workspace",
        mode=WorkspaceMode.MANAGED.value,
    )


@pytest.fixture
def vault_workspace(db):
    return Workspace.objects.create(
        name="Vault Workspace",
        slug="vault-workspace",
        mode=WorkspaceMode.VAULT.value,
    )


@pytest.fixture
def admin_user(managed_workspace):
    """Admin user in managed workspace."""
    user = User.objects.create_user(
        email="admin@example.com",
        password="testpass123",
        workspace=managed_workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Admin User"
    user.identity.save()
    return user


@pytest.fixture
def vault_admin_user(vault_workspace):
    """Admin user in vault workspace."""
    user = User.objects.create_user(
        email="vaultadmin@example.com",
        password="testpass123",
        workspace=vault_workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Vault Admin User"
    user.identity.save()
    return user


@pytest.fixture
def member_user(vault_workspace):
    """Member user in vault workspace."""
    user = User.objects.create_user(
        email="member@example.com",
        password="testpass123",
        workspace=vault_workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Member User"
    user.identity.save()
    return user


@pytest.fixture
def managed_database(managed_workspace):
    return Database.objects.create(
        workspace=managed_workspace,
        name="Test Database",
        database_type=DatabaseType.POSTGRES.value,
    )


@pytest.fixture
def vault_database(vault_workspace):
    return Database.objects.create(
        workspace=vault_workspace,
        name="Vault Test Database",
        database_type=DatabaseType.POSTGRES.value,
    )


@pytest.fixture
def admin_passphrase():
    return "apple brave cloud delta eagle frost green happy"


@pytest.fixture
def member_passphrase():
    return "tiger ultra vivid water zebra amber blaze coral"


@pytest.fixture
def admin_key(vault_admin_user, vault_workspace, admin_passphrase):
    """Admin's approved key in vault workspace."""
    public_key, private_key = generate_user_keypair(admin_passphrase)
    key = UserKey.objects.create(
        workspace=vault_workspace,
        user=vault_admin_user,
        public_key=public_key,
        private_key=private_key,
        passphrase_hint="apple brave",
        confirmed_at=timezone.now(),
        approved_at=timezone.now(),
    )
    return key


@pytest.fixture
def member_key(member_user, vault_workspace, member_passphrase):
    public_key, private_key = generate_user_keypair(member_passphrase)
    key = UserKey.objects.create(
        workspace=vault_workspace,
        user=member_user,
        public_key=public_key,
        private_key=private_key,
        passphrase_hint="tiger ultra",
        confirmed_at=timezone.now(),
    )
    return key


class TestSetDatabaseCredentialsManagedMode:
    """Tests for set_database_credentials in managed mode."""

    def test_creates_credential_with_master_key_encryption(
        self, managed_database, admin_user
    ):
        credentials = {"hostname": "localhost", "port": 5432}

        result = set_database_credentials(
            database=managed_database,
            credentials=credentials,
            admin_user=admin_user,
        )

        assert result.workspace == managed_database.workspace
        assert result.created_by == admin_user
        assert result.encrypted_data is not None
        assert result.nonce != ""
        assert result.algorithm == EncryptionAlgorithm.CHACHA20_POLY1305.value

    def test_credentials_can_be_decrypted(
        self, managed_database, admin_user
    ):
        credentials = {"hostname": "db.example.com", "port": 5432, "ssl": True}

        credential = set_database_credentials(
            database=managed_database,
            credentials=credentials,
            admin_user=admin_user,
        )

        decrypted = get_credentials(credential, admin_user)
        assert decrypted == credentials


class TestSetDatabaseCredentialsVaultMode:
    """Tests for set_database_credentials in vault mode."""

    def test_requires_admin_user_and_passphrase(
        self, vault_database, admin_key
    ):
        credentials = {"hostname": "localhost", "port": 5432}

        with pytest.raises(ValueError, match="admin_user and admin_passphrase required"):
            set_database_credentials(database=vault_database, credentials=credentials)

    def test_creates_user_credentials_for_all_valid_keys(
        self, vault_database, vault_admin_user, admin_key, admin_passphrase,
        member_key
    ):
        # Approve member key first
        member_key.approved_at = timezone.now()
        member_key.save()

        credentials = {"hostname": "localhost", "port": 5432}

        result = set_database_credentials(
            database=vault_database,
            credentials=credentials,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        # Should create UserCredential for both admin and member
        user_credentials = UserCredential.objects.filter(credential=result)
        assert user_credentials.count() == 2

        # Base credential should have encrypted_data (encrypted with symmetric key)
        assert result.encrypted_data is not None
        assert result.encrypted_data != ""
        assert result.nonce is not None
        assert result.nonce != ""
        
        # UserCredentials should have encrypted_key (symmetric key encrypted with user's public key)
        for uc in user_credentials:
            assert uc.encrypted_key is not None
            assert uc.encrypted_key != ""
            assert uc.key_nonce is not None
            assert uc.key_nonce != ""

    def test_only_creates_for_approved_keys(
        self, vault_database, vault_admin_user, admin_key, admin_passphrase,
        member_key
    ):
        # member_key is NOT approved (approved_at is null)
        credentials = {"hostname": "localhost", "port": 5432}

        result = set_database_credentials(
            database=vault_database,
            credentials=credentials,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        # Should only create UserCredential for admin
        user_credentials = UserCredential.objects.filter(credential=result)
        assert user_credentials.count() == 1
        user_cred = user_credentials.first()
        assert user_cred.user_key == admin_key
        # Verify new format fields are populated
        assert user_cred.encrypted_key is not None
        assert user_cred.encrypted_key != ""
        assert user_cred.key_nonce is not None
        assert user_cred.key_nonce != ""


class TestSetAccountCredentials:
    """Tests for set_account_credentials."""
    
    def test_managed_mode(self, managed_database, admin_user):
        account = DatabaseAccount.objects.create(
            database=managed_database,
            name="readonly",
        )
        credentials = {"username": "readonly_user", "password": "secret123"}
        
        result = set_account_credentials(
            account=account,
            credentials=credentials,
            admin_user=admin_user,
        )
        
        assert result.workspace == managed_database.workspace
        
        decrypted = get_credentials(result, admin_user)
        assert decrypted == credentials
    
    def test_vault_mode_requires_passphrase(
        self, vault_database, admin_key
    ):
        account = DatabaseAccount.objects.create(
            database=vault_database,
            name="readonly",
        )
        credentials = {"username": "readonly_user", "password": "secret123"}
        
        with pytest.raises(ValueError, match="admin_user and admin_passphrase required"):
            set_account_credentials(account=account, credentials=credentials)


class TestActivateKey:
    """Tests for activate_key function."""
    
    def test_approves_key_and_provisions_credentials(
        self, vault_workspace, vault_admin_user, member_user, admin_key, member_key,
        admin_passphrase
    ):
        # Create a credential first
        database = Database.objects.create(
            workspace=vault_workspace,
            name="Test Database",
            database_type=DatabaseType.POSTGRES.value,
        )
        credentials = {"hostname": "localhost", "port": 5432}
        set_database_credentials(
            database=database,
            credentials=credentials,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        # member_key is not approved yet
        assert member_key.approved_at is None

        # Activate the member's key
        activate_key(
            key=member_key,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        # Key should now be approved
        member_key.refresh_from_db()
        assert member_key.approved_at is not None

        # Member should have access to credentials
        credential = Credential.objects.filter(workspace=vault_workspace).first()
        user_credential = UserCredential.objects.filter(
            credential=credential,
            user_key=member_key,
        ).first()
        assert user_credential is not None

    def test_fails_if_admin_has_no_valid_key(
        self, vault_workspace, vault_admin_user, member_key
    ):
        # Admin has no key at all
        with pytest.raises(ValueError, match="Admin does not have a valid approved key"):
            activate_key(
                key=member_key,
                admin_user=vault_admin_user,
                admin_passphrase="irrelevant",
            )


class TestGetCredentials:
    """Tests for get_credentials function."""
    
    def test_managed_mode_decryption(
        self, managed_database, admin_user
    ):
        credentials = {"hostname": "db.example.com", "port": 5432, "ssl": True}
        credential = set_database_credentials(
            database=managed_database,
            credentials=credentials,
            admin_user=admin_user,
        )
        
        result = get_credentials(credential, admin_user)
        assert result == credentials
    
    def test_vault_mode_requires_passphrase(
        self, vault_database, vault_admin_user, admin_key, admin_passphrase
    ):
        credentials = {"hostname": "localhost", "port": 5432}
        credential = set_database_credentials(
            database=vault_database,
            credentials=credentials,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        with pytest.raises(ValueError, match="passphrase required for vault mode"):
            get_credentials(credential, vault_admin_user)

    def test_vault_mode_decryption_with_passphrase(
        self, vault_database, vault_admin_user, admin_key, admin_passphrase
    ):
        credentials = {"hostname": "localhost", "port": 5432}
        credential = set_database_credentials(
            database=vault_database,
            credentials=credentials,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        result = get_credentials(credential, vault_admin_user, passphrase=admin_passphrase)
        assert result == credentials

    def test_vault_mode_fails_without_approved_key(
        self, vault_database, vault_admin_user, admin_key, admin_passphrase,
        member_user
    ):
        credentials = {"hostname": "localhost", "port": 5432}
        credential = set_database_credentials(
            database=vault_database,
            credentials=credentials,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        # Member doesn't have a key at all
        with pytest.raises(ValueError, match="User does not have a valid key"):
            get_credentials(credential, member_user, passphrase="whatever")

    def test_vault_mode_fails_with_wrong_passphrase(
        self, vault_database, vault_admin_user, admin_key, admin_passphrase
    ):
        credentials = {"hostname": "localhost", "port": 5432}
        credential = set_database_credentials(
            database=vault_database,
            credentials=credentials,
            admin_user=vault_admin_user,
            admin_passphrase=admin_passphrase,
        )

        with pytest.raises(Exception):
            get_credentials(credential, vault_admin_user, passphrase="wrong passphrase")
    
    def test_managed_mode_fails_without_encrypted_data(
        self, managed_workspace, admin_user
    ):
        # Create credential without encrypted data
        credential = Credential.objects.create(
            workspace=managed_workspace,
            created_by=admin_user,
            algorithm=EncryptionAlgorithm.CHACHA20_POLY1305.value,
        )
        
        with pytest.raises(ValueError, match="Credential has no encrypted data"):
            get_credentials(credential, admin_user)


class TestWorkspaceBoundaryValidation:
    def test_user_credential_workspace_mismatch_rejected(
        self, managed_workspace, admin_user, admin_key
    ):
        credential = Credential.objects.create(
            workspace=managed_workspace,
            created_by=admin_user,
            encrypted_data="deadbeef",
            nonce="bead",
            algorithm=EncryptionAlgorithm.CHACHA20_POLY1305.value,
        )

        with pytest.raises(ValidationError):
            UserCredential.objects.create(
                credential=credential,
                user_key=admin_key,
                encrypted_key="feedface",
                key_nonce="cafe",
                algorithm=EncryptionAlgorithm.CHACHA20_POLY1305.value,
            )


class TestActivateKeyProvisioningMultipleCredentials:
    """Tests that activate_key provisions all existing credentials for new key."""
    
    def test_provisions_all_workspace_credentials(
        self, vault_workspace, vault_admin_user, member_user, admin_key, member_key,
        admin_passphrase, member_passphrase
    ):
        # Create multiple credentials
        database1 = Database.objects.create(
            workspace=vault_workspace,
            name="Database 1",
            database_type=DatabaseType.POSTGRES.value,
        )
        database2 = Database.objects.create(
            workspace=vault_workspace,
            name="Database 2",
            database_type=DatabaseType.MYSQL.value,
        )
        
        creds1 = {"hostname": "server1.example.com", "port": 5432}
        creds2 = {"hostname": "server2.example.com", "port": 3306}

        set_database_credentials(
            database=database1, credentials=creds1,
            admin_user=vault_admin_user, admin_passphrase=admin_passphrase,
        )
        set_database_credentials(
            database=database2, credentials=creds2,
            admin_user=vault_admin_user, admin_passphrase=admin_passphrase,
        )

        # Activate member's key
        activate_key(member_key, vault_admin_user, admin_passphrase)
        
        # Member should be able to decrypt both credentials
        all_credentials = Credential.objects.filter(workspace=vault_workspace)
        assert all_credentials.count() == 2
        
        for credential in all_credentials:
            user_cred = UserCredential.objects.filter(
                credential=credential, user_key=member_key
            ).first()
            assert user_cred is not None
        
        # Verify member can actually decrypt
        cred1 = all_credentials.get(id=Credential.objects.filter(
            workspace=vault_workspace
        ).first().id)
        result = get_credentials(cred1, member_user, passphrase=member_passphrase)
        assert result in [creds1, creds2]


class TestGetAccessibleAccounts:
    """Tests for get_accessible_accounts utility function."""
    
    @pytest.fixture
    def test_workspace(self, db):
        return Workspace.objects.create(
            name="Test Workspace",
            slug="test-workspace",
            mode=WorkspaceMode.MANAGED.value,
        )

    @pytest.fixture
    def user1(self, test_workspace):
        return User.objects.create_user(
            email="user1@example.com",
            password="testpass123",
            workspace=test_workspace,
            role=WorkspaceRole.MEMBER.value,
        )

    @pytest.fixture
    def user2(self, test_workspace):
        return User.objects.create_user(
            email="user2@example.com",
            password="testpass123",
            workspace=test_workspace,
            role=WorkspaceRole.MEMBER.value,
        )

    @pytest.fixture
    def test_admin_user(self, test_workspace):
        """Admin user in test_workspace for granting access."""
        return User.objects.create_user(
            email="testadmin@example.com",
            password="testpass123",
            workspace=test_workspace,
            role=WorkspaceRole.ADMIN.value,
        )

    @pytest.fixture
    def test_group(self, test_workspace):
        return UserGroup.objects.create(
            workspace=test_workspace,
            name="Test Group",
        )
    
    @pytest.fixture
    def database(self, test_workspace):
        return Database.objects.create(
            workspace=test_workspace,
            name="Test Database",
            database_type=DatabaseType.POSTGRES.value,
        )
    
    @pytest.fixture
    def account1(self, database):
        return DatabaseAccount.objects.create(
            database=database,
            name="readonly",
        )
    
    @pytest.fixture
    def account2(self, database):
        return DatabaseAccount.objects.create(
            database=database,
            name="admin",
        )
    
    def test_user_with_no_access(self, user1, test_workspace):
        """User with no access grants should get empty list."""
        accounts = get_accessible_accounts(user1, test_workspace)
        assert accounts == []
    
    def test_user_with_direct_access(self, user1, test_workspace, account1, test_admin_user):
        """User with direct access grant should see the account."""
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )

        accounts = get_accessible_accounts(user1, test_workspace)
        assert len(accounts) == 1
        assert accounts[0].id == account1.id

    def test_user_with_group_access(self, user1, test_workspace, test_group, account1, test_admin_user):
        """User should see accounts accessible via group membership."""
        GroupMembership.objects.create(group=test_group, user=user1)
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            group=test_group,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )

        accounts = get_accessible_accounts(user1, test_workspace)
        assert len(accounts) == 1
        assert accounts[0].id == account1.id

    def test_user_with_multiple_access_grants(
        self, user1, test_workspace, test_group, account1, account2, test_admin_user
    ):
        """User should see all accounts they have access to."""
        GroupMembership.objects.create(group=test_group, user=user1)
        
        # Direct access to account1
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )

        # Group access to account2
        Access.objects.create(
            workspace=test_workspace,
            account=account2,
            group=test_group,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )

        accounts = get_accessible_accounts(user1, test_workspace)
        assert len(accounts) == 2
        account_ids = {a.id for a in accounts}
        assert account_ids == {account1.id, account2.id}

    def test_revoked_access_not_included(self, user1, test_workspace, account1, test_admin_user):
        """Revoked access should not be included."""
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
            revoked_at=timezone.now(),
            revoked_by=test_admin_user,
        )

        accounts = get_accessible_accounts(user1, test_workspace)
        assert accounts == []

    def test_expired_access_not_included(self, user1, test_workspace, account1, test_admin_user):
        """Expired temporary access should not be included."""
        past_time = timezone.now() - timedelta(hours=1)
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
            granted_until=past_time,
        )

        accounts = get_accessible_accounts(user1, test_workspace)
        assert accounts == []

    def test_future_expiry_included(self, user1, test_workspace, account1, test_admin_user):
        """Access with future expiry should be included."""
        future_time = timezone.now() + timedelta(hours=1)
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
            granted_until=future_time,
        )

        accounts = get_accessible_accounts(user1, test_workspace)
        assert len(accounts) == 1
        assert accounts[0].id == account1.id

    def test_not_granted_yet_excluded(self, user1, test_workspace, account1, test_admin_user):
        """Access that hasn't been granted yet (only requested) should not be included."""
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.REQUESTED.value,
            requested_by=user1,
            requested_at=timezone.now(),
            granted_at=None,
        )

        accounts = get_accessible_accounts(user1, test_workspace)
        assert accounts == []

    def test_inactive_account_excluded(self, user1, test_workspace, account1, test_admin_user):
        """Inactive accounts should not be included."""
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )
        account1.is_active = False
        account1.save()

        accounts = get_accessible_accounts(user1, test_workspace)
        assert accounts == []

    def test_inactive_database_excluded(self, user1, test_workspace, account1, test_admin_user):
        """Accounts on inactive databases should not be included."""
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )
        account1.database.is_active = False
        account1.database.save()

        accounts = get_accessible_accounts(user1, test_workspace)
        assert accounts == []

    def test_duplicate_access_grants_deduplicated(
        self, user1, test_workspace, test_group, account1, test_admin_user
    ):
        """Multiple access grants to same account should return account only once."""
        GroupMembership.objects.create(group=test_group, user=user1)

        # Direct access
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            user=user1,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )
        
        # Group access to same account
        Access.objects.create(
            workspace=test_workspace,
            account=account1,
            group=test_group,
            mode=AccessMode.ADMIN_SET.value,
            granted_by=test_admin_user,
            granted_at=timezone.now(),
        )
        
        accounts = get_accessible_accounts(user1, test_workspace)
        assert len(accounts) == 1
        assert accounts[0].id == account1.id
