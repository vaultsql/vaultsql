"""
Utilities for managing credentials in vault and managed modes.

All functions assume authorization has been checked at the API layer.
Passphrases and credentials are never stored on disk - only in memory.
Transaction management is the responsibility of the caller.

Access control in vault mode:
- Credentials are encrypted for all approved device keys by default for simplicity
- Access control is gated via database checks using the Access model
- This allows approval flows (e.g., Slack notifications) without requiring admin's device key
"""

import json
import os
from typing import Dict, Any, Optional, List, Tuple
from django.db.models import Q
from django.utils import timezone
from accounts.models import Workspace, User, WorkspaceMode, WorkspaceRole
from connection.models import (
    Database, DatabaseAccount, Credential, UserCredential, UserKey,
    EncryptionAlgorithm, Access
)
from connection.crypto import (
    encrypt_data,
    decrypt_data,
    encrypt_with_public_key,
    decrypt_with_private_key,
)
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization, hashes

def set_database_credentials(
    database: Database,
    credentials: Dict[str, Any],
    admin_user: Optional[User] = None,
    admin_passphrase: Optional[str] = None,
) -> Credential:
    """
    Set or update database credentials.
    
    For vault mode: encrypts credentials with all approved device keys in the workspace.
                    Access control is enforced separately via the Access model.
    For managed mode: encrypts with master key.
    
    Args:
        database: Database instance
        credentials: Dict containing connection credentials (hostname, port, etc.)
        admin_user: Required for vault mode - the admin setting the credentials
        admin_passphrase: Required for vault mode - admin's passphrase
    
    Returns:
        Created or updated Credential instance
    
    Raises:
        ValueError: If vault mode parameters are missing or invalid
    """
    workspace = database.workspace
    credentials_json = json.dumps(credentials)
    
    if workspace.mode == WorkspaceMode.VAULT.value:
        if not admin_user or not admin_passphrase:
            raise ValueError("admin_user and admin_passphrase required for vault mode")
        
        return _set_credentials_vault_mode(
            workspace=workspace,
            credentials_json=credentials_json,
            created_by=admin_user,
            admin_passphrase=admin_passphrase,
        )
    else:
        # Managed or BYOK mode - use master key encryption
        if admin_user is None:
            admin_user = workspace.users.filter(
                role=WorkspaceRole.ADMIN.value
            ).first()
        if admin_user is None:
            raise ValueError("admin_user required for managed mode")
        return _set_credentials_managed_mode(
            workspace=workspace,
            credentials_json=credentials_json,
            created_by=admin_user,
        )


def set_account_credentials(
    account: DatabaseAccount,
    credentials: Dict[str, Any],
    admin_user: Optional[User] = None,
    admin_passphrase: Optional[str] = None,
) -> Credential:
    """
    Set or update account credentials (DB username/password).
    
    For vault mode: encrypts credentials with all approved device keys in the workspace.
                    Access control is enforced separately via the Access model.
    For managed mode: encrypts with master key.
    
    Args:
        account: DatabaseAccount instance
        credentials: Dict containing DB credentials (username, password, etc.)
        admin_user: Required for vault mode - the admin setting the credentials
        admin_passphrase: Required for vault mode - admin's passphrase
    
    Returns:
        Created or updated Credential instance
    
    Raises:
        ValueError: If vault mode parameters are missing or invalid
    """
    workspace = account.database.workspace
    credentials_json = json.dumps(credentials)
    
    if workspace.mode == WorkspaceMode.VAULT.value:
        if not admin_user or not admin_passphrase:
            raise ValueError("admin_user and admin_passphrase required for vault mode")
        
        return _set_credentials_vault_mode(
            workspace=workspace,
            credentials_json=credentials_json,
            created_by=admin_user,
            admin_passphrase=admin_passphrase,
        )
    else:
        # Managed or BYOK mode
        if admin_user is None:
            admin_user = workspace.users.filter(
                role=WorkspaceRole.ADMIN.value
            ).first()
        if admin_user is None:
            raise ValueError("admin_user required for managed mode")
        return _set_credentials_managed_mode(
            workspace=workspace,
            credentials_json=credentials_json,
            created_by=admin_user,
        )


def activate_key(
    key: UserKey,
    admin_user: User,
    admin_passphrase: str,
) -> None:
    """
    Approve a user's key after admin verification.
    
    When a key is activated, all existing credentials in the workspace are
    encrypted for this new key. Access control is enforced separately via
    the Access model, allowing approval workflows without device key requirements.
    
    Args:
        key: UserKey to activate
        admin_user: Admin approving the key
        admin_passphrase: Admin's passphrase to decrypt existing credentials
    
    Raises:
        ValueError: If admin doesn't have valid key or wrong passphrase
    """
    from django.utils import timezone
    
    workspace = key.workspace
    
    # Verify admin has a valid key
    admin_key = UserKey.objects.filter(
        workspace=workspace,
        user=admin_user,
        approved_at__isnull=False,
        confirmed_at__isnull=False,
        revoked_at__isnull=True,
    ).first()
    
    if not admin_key:
        raise ValueError("Admin does not have a valid approved key in this workspace")
    
    # Approve the key
    key.approved_at = timezone.now()
    key.save()
    
    # Re-encrypt all credentials for this new key
    _provision_credentials_for_key(key, admin_key, admin_passphrase)


def get_credentials(
    credential: Credential,
    user: User,
    passphrase: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve and decrypt credentials for a user.
    
    Args:
        credential: Credential instance to decrypt
        user: User requesting the credentials
        passphrase: Required for vault mode - user's passphrase
    
    Returns:
        Decrypted credentials dict
    
    Raises:
        ValueError: If user doesn't have access or wrong passphrase
    """
    workspace = credential.workspace
    
    if workspace.mode == WorkspaceMode.VAULT.value:
        if not passphrase:
            raise ValueError("passphrase required for vault mode")
        
        # Find user's key
        user_key = UserKey.objects.filter(
            workspace=workspace,
            user=user,
            approved_at__isnull=False,
            confirmed_at__isnull=False,
            revoked_at__isnull=True,
        ).first()
        
        if not user_key:
            raise ValueError("User does not have a valid key in this workspace")
        
        # Find user's encrypted credential
        user_credential = UserCredential.objects.filter(
            credential=credential,
            user_key=user_key,
        ).first()
        
        if not user_credential:
            raise ValueError("User does not have access to this credential")
        
        # Check if using new format (encrypted_key) or old format (encrypted_data)
        if user_credential.encrypted_key:
            # New format: decrypt symmetric key, then decrypt credential data
            if not credential.encrypted_data:
                raise ValueError("Credential has no encrypted data")
            
            symmetric_key = _decrypt_symmetric_key_with_private_key(
                user_credential.encrypted_key,
                user_credential.key_nonce,
                user_key.private_key,
                passphrase,
            )
            
            decrypted_json = _decrypt_data_with_symmetric_key(
                credential.encrypted_data,
                credential.nonce,
                symmetric_key,
            )
        else:
            # Old format: decrypt directly with user's private key
            decrypted_json = decrypt_with_private_key(
                user_credential.encrypted_data,
                user_credential.nonce,
                user_key.private_key,
                passphrase,
            )
    else:
        # Managed mode - decrypt with master key
        if not credential.encrypted_data:
            raise ValueError("Credential has no encrypted data")
        
        decrypted_json = decrypt_data(
            credential.encrypted_data,
            credential.nonce,
        )
    
    return json.loads(decrypted_json)


# Private helper functions

def _encrypt_symmetric_key_with_public_key(
    symmetric_key: bytes,
    public_key_pem: str,
) -> Tuple[str, str]:
    """
    Encrypt a symmetric key with a user's public key using RSA-OAEP.
    
    Args:
        symmetric_key: The symmetric key to encrypt (32 bytes for ChaCha20-Poly1305)
        public_key_pem: PEM-encoded RSA public key
    
    Returns:
        Tuple of (encrypted_key_hex, key_nonce_hex)
        Note: key_nonce is not used for RSA encryption but kept for consistency
    """
    public_key = serialization.load_pem_public_key(public_key_pem.encode('utf-8'))
    
    encrypted_key = public_key.encrypt(
        symmetric_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # Generate a nonce for consistency (though RSA doesn't use it)
    key_nonce = os.urandom(12)
    
    return (encrypted_key.hex(), key_nonce.hex())


def _decrypt_symmetric_key_with_private_key(
    encrypted_key_hex: str,
    key_nonce_hex: str,
    private_key_pem: str,
    passphrase: str,
) -> bytes:
    """
    Decrypt a symmetric key with a user's private key using RSA-OAEP.
    
    Args:
        encrypted_key_hex: Hex-encoded encrypted symmetric key
        key_nonce_hex: Hex-encoded nonce (not used for RSA but kept for consistency)
        private_key_pem: PEM-encoded RSA private key (encrypted with passphrase)
        passphrase: User's passphrase to unlock private key
    
    Returns:
        Decrypted symmetric key bytes
    """
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode('utf-8'),
        password=passphrase.encode('utf-8')
    )
    
    encrypted_key = bytes.fromhex(encrypted_key_hex)
    
    symmetric_key = private_key.decrypt(
        encrypted_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return symmetric_key


def _encrypt_data_with_symmetric_key(
    plaintext: str,
    symmetric_key: bytes,
) -> Tuple[str, str]:
    """
    Encrypt data using ChaCha20-Poly1305 with a provided symmetric key.
    
    Args:
        plaintext: The data to encrypt
        symmetric_key: 32-byte symmetric key
    
    Returns:
        Tuple of (encrypted_data_hex, nonce_hex)
    """
    cipher = ChaCha20Poly1305(symmetric_key)
    nonce = os.urandom(12)
    plaintext_bytes = plaintext.encode('utf-8')
    ciphertext = cipher.encrypt(nonce, plaintext_bytes, None)
    
    return (ciphertext.hex(), nonce.hex())


def _decrypt_data_with_symmetric_key(
    encrypted_data_hex: str,
    nonce_hex: str,
    symmetric_key: bytes,
) -> str:
    """
    Decrypt data using ChaCha20-Poly1305 with a provided symmetric key.
    
    Args:
        encrypted_data_hex: Hex-encoded ciphertext
        nonce_hex: Hex-encoded nonce
        symmetric_key: 32-byte symmetric key
    
    Returns:
        Decrypted plaintext string
    """
    cipher = ChaCha20Poly1305(symmetric_key)
    ciphertext = bytes.fromhex(encrypted_data_hex)
    nonce = bytes.fromhex(nonce_hex)
    plaintext_bytes = cipher.decrypt(nonce, ciphertext, None)
    
    return plaintext_bytes.decode('utf-8')


def _set_credentials_vault_mode(
    workspace: Workspace,
    credentials_json: str,
    created_by: User,
    admin_passphrase: str,
) -> Credential:
    """
    Create credential and encrypt for all approved device keys in vault mode.
    
    Uses symmetric encryption for performance:
    1. Generate a new symmetric key
    2. Encrypt credential data with symmetric key, store in Credential.encrypted_data
    3. For each user key, encrypt the symmetric key with their public key,
       store in UserCredential.encrypted_key and key_nonce
    
    Access control is enforced separately via the Access model. This approach
    allows approval workflows (e.g., Slack notifications) without requiring
    the admin's device key for re-encryption.
    """
    # Generate a new symmetric key (32 bytes for ChaCha20-Poly1305)
    symmetric_key = os.urandom(32)
    
    # Encrypt credential data with symmetric key
    encrypted_data, nonce = _encrypt_data_with_symmetric_key(
        credentials_json,
        symmetric_key,
    )
    
    # Create base credential with encrypted data
    credential = Credential.objects.create(
        workspace=workspace,
        created_by=created_by,
        encrypted_data=encrypted_data,
        nonce=nonce,
        algorithm=EncryptionAlgorithm.CHACHA20_POLY1305.value,
    )
    
    # Get all approved, non-revoked keys
    valid_keys = UserKey.objects.filter(
        workspace=workspace,
        approved_at__isnull=False,
        confirmed_at__isnull=False,
        revoked_at__isnull=True,
    )
    
    # Encrypt symmetric key for each valid key
    for user_key in valid_keys:
        encrypted_key, key_nonce = _encrypt_symmetric_key_with_public_key(
            symmetric_key,
            user_key.public_key,
        )
        
        UserCredential.objects.create(
            credential=credential,
            user_key=user_key,
            encrypted_key=encrypted_key,
            key_nonce=key_nonce,
            algorithm=EncryptionAlgorithm.CHACHA20_POLY1305.value,
        )
    
    return credential


def _set_credentials_managed_mode(
    workspace: Workspace,
    credentials_json: str,
    created_by: User,
) -> Credential:
    """Create credential with master key encryption for managed mode."""
    encrypted_data, nonce = encrypt_data(credentials_json)
    
    credential = Credential.objects.create(
        workspace=workspace,
        created_by=created_by,
        encrypted_data=encrypted_data,
        nonce=nonce,
        algorithm=EncryptionAlgorithm.CHACHA20_POLY1305.value,
    )
    
    return credential


def _provision_credentials_for_key(
    new_key: UserKey,
    admin_key: UserKey,
    admin_passphrase: str,
) -> None:
    """
    Provision all workspace credentials for a newly activated key.
    
    Decrypts the symmetric key using admin's key, then encrypts it for the new key.
    The credential data itself is not re-encrypted - we share the same symmetric key.
    
    In vault mode, we encrypt credentials for all approved device keys by default.
    Access control is enforced separately via the Access model, allowing approval
    workflows without requiring admin's device key for re-encryption.
    """
    workspace = new_key.workspace
    
    # Get all credentials in workspace
    credentials = Credential.objects.filter(workspace=workspace)
    
    for credential in credentials:
        # Get admin's encrypted version
        admin_credential = UserCredential.objects.filter(
            credential=credential,
            user_key=admin_key,
        ).first()
        
        if not admin_credential:
            continue
        
        # Check if using new format (encrypted_key) or old format (encrypted_data)
        if admin_credential.encrypted_key:
            # New format: decrypt symmetric key
            symmetric_key = _decrypt_symmetric_key_with_private_key(
                admin_credential.encrypted_key,
                admin_credential.key_nonce,
                admin_key.private_key,
                admin_passphrase,
            )
            
            # Encrypt symmetric key for new key
            encrypted_key, key_nonce = _encrypt_symmetric_key_with_public_key(
                symmetric_key,
                new_key.public_key,
            )
            
            # Create or update user credential
            UserCredential.objects.update_or_create(
                credential=credential,
                user_key=new_key,
                defaults={
                    'encrypted_key': encrypted_key,
                    'key_nonce': key_nonce,
                    'algorithm': EncryptionAlgorithm.CHACHA20_POLY1305.value,
                }
            )
        else:
            # Old format: decrypt data, generate new symmetric key, re-encrypt everything
            # This handles migration from old format
            decrypted = decrypt_with_private_key(
                admin_credential.encrypted_data,
                admin_credential.nonce,
                admin_key.private_key,
                admin_passphrase,
            )
            
            # Generate new symmetric key and re-encrypt credential data
            symmetric_key = os.urandom(32)
            encrypted_data, nonce = _encrypt_data_with_symmetric_key(
                decrypted,
                symmetric_key,
            )
            
            # Update credential with new encrypted data
            credential.encrypted_data = encrypted_data
            credential.nonce = nonce
            credential.save()
            
            # Encrypt symmetric key for new key
            encrypted_key, key_nonce = _encrypt_symmetric_key_with_public_key(
                symmetric_key,
                new_key.public_key,
            )
            
            # Create or update user credential
            UserCredential.objects.update_or_create(
                credential=credential,
                user_key=new_key,
                defaults={
                    'encrypted_key': encrypted_key,
                    'key_nonce': key_nonce,
                    'algorithm': EncryptionAlgorithm.CHACHA20_POLY1305.value,
                }
            )


def get_accessible_accounts(user: User, workspace: Workspace) -> List[DatabaseAccount]:
    """
    Get all accounts that a user has access to in a workspace.
    
    Access is determined by:
    1. Direct user access grants
    2. Group membership access grants
    3. Access must not be revoked
    4. Access must not be expired (if granted_until is set)
    
    Args:
        user: User to check access for
        workspace: Workspace to check within
    
    Returns:
        List of DatabaseAccount instances the user can access
    """
    now = timezone.now()
    
    # Get user's groups in this workspace
    user_groups = user.group_memberships.filter(
        group__workspace=workspace
    ).values_list('group_id', flat=True)
    
    # Find all active access grants for this user
    access_grants = Access.objects.filter(
        Q(user=user) | Q(group_id__in=user_groups),
        account__database__workspace=workspace,
        revoked_at__isnull=True,
        granted_at__isnull=False,
    ).filter(
        Q(granted_until__isnull=True) | Q(granted_until__gt=now)
    ).select_related('account', 'account__database')
    
    # Extract unique accounts
    account_ids = access_grants.values_list('account_id', flat=True).distinct()
    
    return list(DatabaseAccount.objects.filter(
        id__in=account_ids,
        is_active=True,
        database__is_active=True,
    ).select_related('database'))
