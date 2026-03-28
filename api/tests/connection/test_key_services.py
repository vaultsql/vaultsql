"""
Tests for KeyLifecycleService.

Sanity checks for key lifecycle management including creation, confirmation,
and the recovery flow.
"""

import pytest
from django.utils import timezone

from accounts.models import User, Workspace, WorkspaceMode, WorkspaceRole
from connection.models import UserKey
from connection.key_service import KeyLifecycleService


@pytest.fixture
def vault_workspace(db):
    """Create a vault mode workspace."""
    return Workspace.objects.create(
        name="Vault Test Workspace",
        slug="vault-test",
        mode=WorkspaceMode.VAULT.value,
    )


@pytest.fixture
def vault_admin_user(vault_workspace):
    """Create an admin user in vault workspace."""
    user = User.objects.create_user(
        email="admin@vault.test",
        password="testpass123",
        workspace=vault_workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Admin User"
    user.identity.save()
    return user


@pytest.fixture
def vault_admin_user_2(vault_workspace):
    """Create a second admin user in vault workspace."""
    user = User.objects.create_user(
        email="admin2@vault.test",
        password="testpass123",
        workspace=vault_workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Admin Two"
    user.identity.save()
    return user


@pytest.fixture
def vault_member_user(vault_workspace):
    """Create a member user in vault workspace."""
    user = User.objects.create_user(
        email="member@vault.test",
        password="testpass123",
        workspace=vault_workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Member User"
    user.identity.save()
    return user


@pytest.mark.django_db
class TestKeyLifecycleServiceQueries:
    """Sanity checks for query methods."""

    def test_get_active_key_returns_correct_key(
        self, vault_workspace, vault_admin_user
    ):
        """get_active_key should return confirmed + approved + non-revoked key."""
        active = UserKey.objects.create(
            workspace=vault_workspace,
            user=vault_admin_user,
            public_key="pub",
            private_key="priv",
            passphrase_hint="hint",
            confirmed_at=timezone.now(),
            approved_at=timezone.now(),
        )
        
        result = KeyLifecycleService.get_active_key(vault_workspace, vault_admin_user)
        assert result is not None
        assert result.id == active.id

    def test_get_pending_key_returns_confirmed_unapproved(
        self, vault_workspace, vault_admin_user
    ):
        """get_pending_key should return confirmed but unapproved key."""
        pending = UserKey.objects.create(
            workspace=vault_workspace,
            user=vault_admin_user,
            public_key="pub",
            private_key="priv",
            passphrase_hint="hint",
            confirmed_at=timezone.now(),
        )
        
        result = KeyLifecycleService.get_pending_key(vault_workspace, vault_admin_user)
        assert result is not None
        assert result.id == pending.id

    def test_is_solo_admin(
        self, vault_workspace, vault_admin_user, vault_admin_user_2
    ):
        """is_solo_admin should detect single vs multiple admins."""
        # With 2 admins
        assert KeyLifecycleService.is_solo_admin(vault_workspace, vault_admin_user) is False
        
        # Remove second admin
        vault_admin_user_2.delete()
        assert KeyLifecycleService.is_solo_admin(vault_workspace, vault_admin_user) is True


@pytest.mark.django_db
class TestKeyLifecycleServiceCreateKey:
    """Sanity checks for key creation."""

    def test_create_key_generates_valid_key(
        self, vault_workspace, vault_admin_user, vault_admin_user_2
    ):
        """create_key should generate a valid key with passphrase."""
        key, passphrase = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        
        assert key.workspace == vault_workspace
        assert key.user == vault_admin_user
        assert key.confirmed_at is None  # Not confirmed yet
        assert key.approved_at is None  # Not approved yet
        assert len(passphrase.split()) == 12  # 12-word passphrase
        assert key.passphrase_hint == " ".join(passphrase.split()[:2])  # First 2 words

    def test_create_key_auto_approves_for_solo_admin(
        self, vault_workspace, vault_admin_user
    ):
        """Solo admin keys should be auto-confirmed and auto-approved."""
        key, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        
        assert key.confirmed_at is not None
        assert key.approved_at is not None

    def test_create_key_does_not_revoke_existing_keys(
        self, vault_workspace, vault_admin_user, vault_admin_user_2
    ):
        """Creating a key should NOT revoke existing keys."""
        key1, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        key1.confirmed_at = timezone.now()
        key1.approved_at = timezone.now()
        key1.save()
        
        key2, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        
        key1.refresh_from_db()
        assert key1.revoked_at is None  # Still active


@pytest.mark.django_db
class TestKeyLifecycleServiceConfirmKey:
    """Sanity checks for key confirmation."""

    def test_confirm_key_revokes_other_keys(
        self, vault_workspace, vault_admin_user, vault_admin_user_2
    ):
        """Confirming a key should revoke all other keys."""
        # Create and activate first key
        key1, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        key1.confirmed_at = timezone.now()
        key1.approved_at = timezone.now()
        key1.save()
        
        # Create second key
        key2, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        
        # Confirm second key
        needs_approval = KeyLifecycleService.confirm_key(key2)
        
        # First key should be revoked
        key1.refresh_from_db()
        assert key1.revoked_at is not None
        
        # Second key should be confirmed
        key2.refresh_from_db()
        assert key2.confirmed_at is not None
        assert needs_approval is True


@pytest.mark.django_db
class TestKeyLifecycleServiceActivateKey:
    """Sanity check for key activation."""

    def test_activate_key_raises_for_unconfirmed(
        self, vault_workspace, vault_admin_user, vault_admin_user_2
    ):
        """activate_key should raise if key is not confirmed."""
        key, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        
        with pytest.raises(ValueError, match="Key must be confirmed before approval"):
            KeyLifecycleService.activate_key(key, vault_admin_user_2, "dummy_pass")


@pytest.mark.django_db
class TestKeyRecoveryFlow:
    """Sanity check for the recovery flow."""

    def test_recovery_flow_revokes_old_key_on_confirm(
        self, vault_workspace, vault_admin_user, vault_admin_user_2
    ):
        """Recovery: old key stays active until new key is confirmed."""
        # User has an active key
        old_key, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        KeyLifecycleService.confirm_key(old_key)
        
        old_key.refresh_from_db()
        assert old_key.approved_at is None  # Needs admin approval
        
        # User creates new key (recovery) - old key still active
        new_key, _ = KeyLifecycleService.create_key(vault_workspace, vault_admin_user)
        
        old_key.refresh_from_db()
        assert old_key.revoked_at is None  # Still active
        
        # User confirms new key - NOW old key is revoked
        KeyLifecycleService.confirm_key(new_key)
        
        old_key.refresh_from_db()
        assert old_key.revoked_at is not None  # Revoked
        
        new_key.refresh_from_db()
        assert new_key.confirmed_at is not None  # Confirmed
        assert new_key.approved_at is None  # Awaiting approval
