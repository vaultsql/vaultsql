"""
Cryptographic utilities for credential encryption/decryption.

Uses ChaCha20-Poly1305 for authenticated encryption (AEAD).
All encryption operations use a 96-bit (12-byte) nonce.

=== GENERATING A SECURE SECRET_KEY ===

The SECRET_KEY/ENCRYPTION_KEY should be a cryptographically secure random string.

To generate a good key:

1. Using Python (recommended for production):
   ```python
   import secrets
   print(secrets.token_urlsafe(64))
   ```
   This generates a 64-byte URL-safe base64-encoded string (~86 characters).

2. Using OpenSSL:
   ```bash
   openssl rand -base64 64
   ```

3. Using /dev/urandom:
   ```bash
   head -c 64 /dev/urandom | base64
   ```

IMPORTANT:
- Key should be at least 32 bytes of entropy (256 bits)
- Never commit the key to version control
- Use different keys for dev/staging/production
- Rotate keys periodically (requires re-encrypting all credentials)
- Store securely (environment variables, secrets manager, etc.)
"""

import hashlib
import os
import secrets
from typing import Tuple

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
from django.conf import settings
from mnemonic import Mnemonic


def get_master_key() -> bytes:
    """
    Derive a 256-bit key from the ENCRYPTION_KEY setting.
    Uses SHA-256 to ensure proper key length.
    """
    key_material = settings.ENCRYPTION_KEY.encode('utf-8')
    return hashlib.sha256(key_material).digest()


def encrypt_data(plaintext: str) -> Tuple[str, str]:
    """
    Encrypt data using ChaCha20-Poly1305.
    
    Args:
        plaintext: The data to encrypt (will be UTF-8 encoded)
    
    Returns:
        Tuple of (encrypted_data_hex, nonce_hex)
    """
    key = get_master_key()
    cipher = ChaCha20Poly1305(key)
    
    # Generate random 96-bit nonce
    nonce = os.urandom(12)
    
    # Encrypt
    plaintext_bytes = plaintext.encode('utf-8')
    ciphertext = cipher.encrypt(nonce, plaintext_bytes, None)
    
    # Return as hex strings for storage
    return (ciphertext.hex(), nonce.hex())


def decrypt_data(encrypted_data_hex: str, nonce_hex: str) -> str:
    """
    Decrypt data using ChaCha20-Poly1305.
    
    Args:
        encrypted_data_hex: Hex-encoded ciphertext
        nonce_hex: Hex-encoded nonce
    
    Returns:
        Decrypted plaintext string
    
    Raises:
        cryptography.exceptions.InvalidTag: If decryption/authentication fails
    """
    key = get_master_key()
    cipher = ChaCha20Poly1305(key)
    
    # Convert from hex
    ciphertext = bytes.fromhex(encrypted_data_hex)
    nonce = bytes.fromhex(nonce_hex)
    
    # Decrypt
    plaintext_bytes = cipher.decrypt(nonce, ciphertext, None)
    return plaintext_bytes.decode('utf-8')


def encrypt_with_public_key(plaintext: str, public_key_pem: str) -> Tuple[str, str]:
    """
    Encrypt data with a user's public key using hybrid encryption.
    
    Uses hybrid encryption approach:
    1. Generate a random 256-bit symmetric key (data encryption key / DEK)
    2. Encrypt the plaintext with DEK using ChaCha20-Poly1305
    3. Encrypt the DEK with the RSA public key using RSA-OAEP
    4. Return combined ciphertext (encrypted DEK + encrypted data)
    
    Why hybrid encryption?
    - RSA can only encrypt small amounts of data (~4096 bits for 4096-bit key)
    - Hybrid approach: RSA encrypts a symmetric key, symmetric key encrypts data
    - This is the standard approach (used by PGP, TLS, etc.)
    
    Args:
        plaintext: The data to encrypt
        public_key_pem: PEM-encoded RSA public key
    
    Returns:
        Tuple of (encrypted_data_hex, nonce_hex)
        encrypted_data_hex contains: [encrypted_dek][encrypted_plaintext]
    """
    # Load the public key
    public_key = serialization.load_pem_public_key(public_key_pem.encode('utf-8'))
    
    # Generate random 256-bit DEK
    dek = os.urandom(32)
    
    # Encrypt plaintext with DEK using ChaCha20-Poly1305
    cipher = ChaCha20Poly1305(dek)
    nonce = os.urandom(12)
    plaintext_bytes = plaintext.encode('utf-8')
    encrypted_plaintext = cipher.encrypt(nonce, plaintext_bytes, None)
    
    # Encrypt DEK with RSA public key using OAEP padding
    encrypted_dek = public_key.encrypt(
        dek,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # Combine: [encrypted_dek][encrypted_plaintext]
    combined = encrypted_dek + encrypted_plaintext
    
    return (combined.hex(), nonce.hex())


def decrypt_with_private_key(
    encrypted_data_hex: str,
    nonce_hex: str,
    private_key_pem: str,
    passphrase: str
) -> str:
    """
    Decrypt data with a user's private key using hybrid decryption.
    
    Steps:
    1. Load and decrypt the RSA private key using the passphrase
    2. Extract encrypted DEK from the ciphertext
    3. Decrypt the DEK using RSA-OAEP with the private key
    4. Decrypt the actual data using the DEK with ChaCha20-Poly1305
    5. Return plaintext
    
    Args:
        encrypted_data_hex: Hex-encoded combined ciphertext [encrypted_dek][encrypted_data]
        nonce_hex: Hex-encoded nonce
        private_key_pem: PEM-encoded RSA private key (encrypted with passphrase)
        passphrase: User's passphrase to unlock private key
    
    Returns:
        Decrypted plaintext string
    
    Raises:
        ValueError: If passphrase is incorrect or key is invalid
        cryptography.exceptions.InvalidTag: If decryption/authentication fails
    """
    # Load and decrypt the private key using passphrase
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode('utf-8'),
        password=passphrase.encode('utf-8')
    )
    
    # Decode from hex
    combined = bytes.fromhex(encrypted_data_hex)
    nonce = bytes.fromhex(nonce_hex)
    
    # For 4096-bit RSA key, encrypted DEK is 512 bytes
    encrypted_dek = combined[:512]
    encrypted_plaintext = combined[512:]
    
    # Decrypt DEK with RSA private key
    dek = private_key.decrypt(
        encrypted_dek,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # Decrypt plaintext with DEK
    cipher = ChaCha20Poly1305(dek)
    plaintext_bytes = cipher.decrypt(nonce, encrypted_plaintext, None)
    
    return plaintext_bytes.decode('utf-8')


def generate_user_keypair(passphrase: str) -> Tuple[str, str]:
    """
    Generate an RSA keypair for a user, with private key encrypted by passphrase.
    
    The private key is encrypted using the passphrase so it can be safely stored
    in the database. The passphrase is required to decrypt and use the private key.
    
    Args:
        passphrase: User's passphrase to encrypt private key
    
    Returns:
        Tuple of (public_key_pem, encrypted_private_key_pem)
    """
    # Generate 4096-bit RSA keypair
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=4096,
    )
    public_key = private_key.public_key()
    
    # Serialize public key
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode('utf-8')
    
    # Serialize private key, encrypted with passphrase
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.BestAvailableEncryption(passphrase.encode('utf-8'))
    ).decode('utf-8')
    
    return (public_pem, private_pem)


def generate_passphrase(num_words: int = 12) -> str:
    """
    Generate a random passphrase using the BIP39 word list.
    
    BIP39 provides:
    - 2048 carefully chosen words
    - Each word is unique in first 4 letters (easier typing)
    - Words are common and easy to spell
    - Standardized and well-tested
    
    Args:
        num_words: Number of words in passphrase (default 12)
                   12 words ≈ 132 bits entropy with 2048-word list
    
    Returns:
        Space-separated passphrase
    """
    mnemo = Mnemonic("english")
    wordlist = mnemo.wordlist  # 2048 words
    
    # Use secrets.choice for cryptographically secure selection
    selected = [secrets.choice(wordlist) for _ in range(num_words)]
    
    return ' '.join(selected)


def get_passphrase_hint(passphrase: str, num_hint_words: int = 2) -> str:
    """
    Extract first N words from passphrase as a hint.
    
    Args:
        passphrase: Full passphrase
        num_hint_words: Number of words to use as hint
    
    Returns:
        Hint string
    """
    words = passphrase.split()
    return ' '.join(words[:num_hint_words])
