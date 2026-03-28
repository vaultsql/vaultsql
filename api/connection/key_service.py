"""
Centralized service for UserKey lifecycle management.

This service encapsulates all business logic related to key creation, confirmation,
activation, and revocation. It ensures consistent key state management and provides
type-safe query methods for finding keys in various states.
"""

from __future__ import annotations
from typing import Tuple
from django.db.models import QuerySet
from django.utils import timezone

from accounts.models import User, Workspace, WorkspaceRole
from connection.models import UserKey
from connection.crypto import (
    generate_user_keypair,
    get_passphrase_hint,
    generate_passphrase,
    encrypt_with_public_key,
)
from connection.utils import activate_key as _activate_key


class KeyLifecycleService:
    """Centralized service for UserKey lifecycle management."""

    # ========== Query Methods ==========

    @staticmethod
    def get_active_key(workspace: Workspace, user: User) -> UserKey | None:
        """
        Get user's active key (confirmed + approved + not revoked).
        
        An active key is one that can be used to decrypt credentials.
        
        Args:
            workspace: The workspace to query within
            user: The user whose key to find
            
        Returns:
            The most recently approved active key, or None if no active key exists
        """
        return UserKey.objects.filter(
            workspace=workspace,
            user=user,
            confirmed_at__isnull=False,
            approved_at__isnull=False,
            revoked_at__isnull=True,
        ).order_by('-approved_at').first()

    @staticmethod
    def get_pending_key(workspace: Workspace, user: User) -> UserKey | None:
        """
        Get user's pending key (confirmed, not approved, not revoked).
        
        A pending key is one that the user has confirmed but is awaiting admin approval.
        
        Args:
            workspace: The workspace to query within
            user: The user whose key to find
            
        Returns:
            The most recently confirmed pending key, or None if no pending key exists
        """
        return UserKey.objects.filter(
            workspace=workspace,
            user=user,
            confirmed_at__isnull=False,
            approved_at__isnull=True,
            revoked_at__isnull=True,
        ).order_by('-confirmed_at').first()

    @staticmethod
    def get_current_key(workspace: Workspace, user: User) -> UserKey | None:
        """
        Get user's current key (confirmed + not revoked, regardless of approval status).
        
        This is the single source of truth for key state:
        - None → user needs to create a key
        - key.approved_at is None → key is pending approval
        - key.approved_at is set → key is active and ready to use
        
        Args:
            workspace: The workspace to query within
            user: The user whose key to find
            
        Returns:
            The most recently confirmed non-revoked key, or None if no key exists
        """
        return UserKey.objects.filter(
            workspace=workspace,
            user=user,
            confirmed_at__isnull=False,
            revoked_at__isnull=True,
        ).order_by('-confirmed_at').first()

    @staticmethod
    def get_unconfirmed_key(workspace: Workspace, user: User) -> UserKey | None:
        """
        Get user's most recent unconfirmed key (not confirmed, not revoked).
        
        An unconfirmed key is one that was created but the user hasn't yet confirmed
        they've saved the passphrase. These keys may be orphaned if the user abandons
        the key creation flow.
        
        Args:
            workspace: The workspace to query within
            user: The user whose key to find
            
        Returns:
            The most recently created unconfirmed key, or None if no unconfirmed key exists
        """
        return UserKey.objects.filter(
            workspace=workspace,
            user=user,
            confirmed_at__isnull=True,
            revoked_at__isnull=True,
        ).order_by('-created_at').first()

    @staticmethod
    def get_non_revoked_keys(workspace: Workspace, user: User) -> QuerySet[UserKey]:
        """
        Get all non-revoked keys for user.
        
        Args:
            workspace: The workspace to query within
            user: The user whose keys to find
            
        Returns:
            QuerySet of all non-revoked keys for the user
        """
        return UserKey.objects.filter(
            workspace=workspace,
            user=user,
            revoked_at__isnull=True,
        )

    @staticmethod
    def is_solo_admin(workspace: Workspace, user: User) -> bool:
        """
        Check if user is the only admin in the workspace.
        
        Solo admins get special treatment: their keys are auto-confirmed and auto-approved
        since there's no other admin to approve them.
        
        Args:
            workspace: The workspace to check
            user: The user to check
            
        Returns:
            True if user is the only active admin in the workspace
        """
        admin_count = workspace.users.filter(
            role=WorkspaceRole.ADMIN.value,
            is_active=True,
            deactivated_at__isnull=True,
        ).count()
        return admin_count == 1 and user.role == WorkspaceRole.ADMIN.value

    # ========== Lifecycle Methods ==========

    @staticmethod
    def create_key(workspace: Workspace, user: User) -> Tuple[UserKey, str]:
        """
        Create a new unconfirmed key for the user.
        
        Does NOT revoke existing keys - that happens on confirm. This allows users
        to abandon the key creation flow without losing access to their existing key.
        
        Solo admins get auto-confirmed and auto-approved since there's no other admin
        to approve their key.
        
        Args:
            workspace: The workspace to create the key in
            user: The user to create the key for
            
        Returns:
            Tuple of (key, passphrase) - passphrase is shown only once and never stored
            
        Raises:
            ValueError: If key creation fails
        """
        is_solo = KeyLifecycleService.is_solo_admin(workspace, user)

        # Generate 12-word passphrase
        passphrase = generate_passphrase(12)
        hint = get_passphrase_hint(passphrase, 2)

        # Generate RSA-4096 keypair
        public_pem, private_pem = generate_user_keypair(passphrase)

        # Create sample payload for passphrase testing
        sample_encrypted, sample_nonce = encrypt_with_public_key("hello", public_pem)

        key = UserKey.objects.create(
            workspace=workspace,
            user=user,
            public_key=public_pem,
            private_key=private_pem,
            passphrase_hint=hint,
            sample_payload=sample_encrypted,
            sample_nonce=sample_nonce,
            # Solo admins auto-confirm and auto-approve
            confirmed_at=timezone.now() if is_solo else None,
            approved_at=timezone.now() if is_solo else None,
        )

        return (key, passphrase)

    @staticmethod
    def confirm_key(key: UserKey) -> bool:
        """
        Mark key as confirmed and revoke all other non-revoked keys.
        
        This is called when the user confirms they've saved their passphrase.
        At this point, we revoke all other keys (including any active key) since
        the user is committing to using this new key.
        
        Args:
            key: The key to confirm
            
        Returns:
            True if admin notification is needed (key not auto-approved), False otherwise
            
        Raises:
            ValueError: If key is already revoked
        """
        if key.confirmed_at:
            # Already confirmed - this is idempotent
            return key.approved_at is None

        if key.revoked_at:
            raise ValueError("Cannot confirm a revoked key")

        now = timezone.now()

        # Revoke all OTHER non-revoked keys for this user
        UserKey.objects.filter(
            workspace=key.workspace,
            user=key.user,
            revoked_at__isnull=True,
        ).exclude(id=key.id).update(revoked_at=now)

        # Confirm this key
        key.confirmed_at = now
        key.save(update_fields=['confirmed_at'])

        # Return whether admin notification is needed
        return key.approved_at is None

    @staticmethod
    def activate_key(key: UserKey, admin_user: User, admin_passphrase: str) -> None:
        """
        Approve key and re-encrypt all workspace credentials for this key.
        
        This delegates to the existing activate_key utility which handles:
        1. Verifying admin has a valid key
        2. Marking the key as approved
        3. Re-encrypting all workspace credentials for the new key
        
        Args:
            key: The key to activate
            admin_user: The admin approving the key
            admin_passphrase: The admin's passphrase to decrypt existing credentials
            
        Raises:
            ValueError: If key state is invalid, admin doesn't have valid key,
                       or admin passphrase is incorrect
        """
        if key.approved_at:
            raise ValueError("Key already approved")
        if not key.confirmed_at:
            raise ValueError("Key must be confirmed before approval")
        if key.revoked_at:
            raise ValueError("Cannot approve a revoked key")

        # Delegate to existing utility (handles credential re-encryption)
        _activate_key(key, admin_user, admin_passphrase)

    @staticmethod
    def revoke_key(key: UserKey) -> None:
        """
        Revoke a key. It can no longer be used for decryption.
        
        This is idempotent - revoking an already-revoked key is a no-op.
        
        Args:
            key: The key to revoke
        """
        if key.revoked_at:
            return  # Already revoked

        key.revoked_at = timezone.now()
        key.save(update_fields=['revoked_at'])
