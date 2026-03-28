from enum import Enum
from django.db import models
from accounts.models import UUIDModel, User, Workspace, UserGroup
from accounts.managers import WorkspaceScopedManager


class EncryptionAlgorithm(str, Enum):
    CHACHA20_POLY1305 = "chacha20-poly1305"  # Default: fast, secure AEAD cipher
    AES_256_GCM = "aes-256-gcm"
    

class DatabaseType(str, Enum):
    POSTGRES = "postgres"
    MYSQL = "mysql"
    MSSQL = "mssql"
    ORACLE = "oracle"
    SNOWFLAKE = "snowflake"
    REDSHIFT = "redshift"
    BIGQUERY = "bigquery"


class AccessMode(str, Enum):
    ADMIN_SET = "admin-set"
    REQUESTED = "requested"
    AUTOMATIC = "automatic"


class AccountAccessLevel(str, Enum):
    READONLY = "readonly"
    WRITE = "write"
    ADMIN = "admin"


class DatabaseEnvironment(str, Enum):
    PRODUCTION = "production"
    STAGING = "staging"
    TESTING = "testing"
    DEVELOPMENT = "development"


class UserKey(UUIDModel):
    """
    Public/private keypair for a user within a workspace. Keys must be approved by admins
    and can be revoked. Used in vault mode for client-side encryption.
    Keys are workspace-scoped for better isolation and security.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="user_keys")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="keys")
    public_key = models.TextField()
    private_key = models.TextField()
    
    # Passphrase hint (e.g., first 2 words of 12-word passphrase)
    passphrase_hint = models.CharField(max_length=100, blank=True, help_text="First few words of passphrase to help user identify which key")
    
    # Sample payload for passphrase testing (NEVER store the actual passphrase)
    sample_payload = models.TextField(blank=True, help_text="Encrypted sample text to test passphrase")
    sample_nonce = models.CharField(max_length=512, blank=True, help_text="Nonce for sample payload")
    
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    objects = WorkspaceScopedManager()

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "user", "revoked_at"]),
            models.Index(fields=["user", "revoked_at"]),
            models.Index(fields=["approved_at"]),
            models.Index(fields=["confirmed_at"]),
        ]

    def clean(self):
        """Validate user belongs to workspace."""
        super().clean()
        if self.user_id and self.workspace_id:
            if self.user.workspace_id != self.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    f"User {self.user.email} is not in workspace {self.workspace.slug}"
                )

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Key for {self.user.email} in {self.workspace.slug} (created {self.created_at})"


class Credential(UUIDModel):
    """
    Base credential containing encrypted data. Uses ChaCha20-Poly1305 by default,
    which provides authenticated encryption with a 96-bit nonce.
    UserCredential entries point to this and provide per-user access.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="credentials")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_credentials")
    
    # Encrypted credential data (hex-encoded)
    encrypted_data = models.TextField(null=True, blank=True)
    # 96-bit nonce for ChaCha20-Poly1305 (hex-encoded, 24 chars)
    nonce = models.CharField(max_length=512, blank=True)
    # Encryption algorithm used
    algorithm = models.CharField(
        max_length=50,
        choices=[(algo.value, algo.name) for algo in EncryptionAlgorithm],
        default=EncryptionAlgorithm.CHACHA20_POLY1305.value
    )
    # Additional metadata if needed (key version, etc.)
    encryption_metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceScopedManager()

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "created_at"]),
        ]

    def clean(self):
        """Validate created_by belongs to workspace."""
        super().clean()
        if self.created_by_id and self.workspace_id:
            if self.created_by.workspace_id != self.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    f"User {self.created_by.email} is not in workspace {self.workspace.slug}"
                )

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Credential {self.id} in {self.workspace.slug}"


class UserCredential(UUIDModel):
    """
    Per-user encrypted credential. The credential data is encrypted with
    the user's public key so only they can decrypt it with their private key.
    
    For performance, the data is encrypted with a symmetric key, and that
    symmetric key is encrypted with the user's asymmetric public key.
    """
    credential = models.ForeignKey(Credential, on_delete=models.CASCADE, related_name="user_credentials")
    user_key = models.ForeignKey(UserKey, on_delete=models.CASCADE, related_name="user_credentials")
    
    # Credential encrypted with the user's public key (hex-encoded)
    # Deprecated: Used in old format. New format uses encrypted_key instead.
    encrypted_data = models.TextField(null=True, blank=True)
    # 96-bit nonce (hex-encoded, 24 chars)
    # Deprecated: Used in old format. New format uses key_nonce instead.
    nonce = models.CharField(max_length=512, blank=True)
    algorithm = models.CharField(
        max_length=50,
        choices=[(algo.value, algo.name) for algo in EncryptionAlgorithm],
        default=EncryptionAlgorithm.CHACHA20_POLY1305.value
    )
    
    # Symmetric key encrypted with the user's public key (hex-encoded)
    encrypted_key = models.TextField(null=True, blank=True)
    # Nonce used when encrypting the symmetric key (hex-encoded)
    key_nonce = models.CharField(max_length=512, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [["credential", "user_key"]]
        indexes = [
            models.Index(fields=["credential", "user_key"]),
            models.Index(fields=["user_key"]),
        ]

    def clean(self):
        """Validate credential workspace matches user key workspace."""
        super().clean()
        if self.credential_id and self.user_key_id:
            if self.credential.workspace_id != self.user_key.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    "UserCredential credential workspace must match user key workspace"
                )

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"UserCredential for {self.user_key.user.email} -> {self.credential.id}"


class Database(UUIDModel):
    """
    A database instance. Contains connection info and references
    a credential for base connectivity (SSH tunnel, hostname, etc.).
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="databases")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    database_type = models.CharField(
        max_length=20,
        choices=[(stype.value, stype.name) for stype in DatabaseType]
    )
    
    # Credential containing SSH config, hostname, base connection params
    database_credential = models.ForeignKey(
        Credential,
        on_delete=models.CASCADE,
        related_name="databases",
        null=True,
        blank=True,
        help_text="Base credential for database connectivity (hostname, SSH config, etc.)"
    )
    
    # Optional environment classification
    environment = models.CharField(
        max_length=20,
        choices=[(env.value, env.name) for env in DatabaseEnvironment],
        null=True,
        blank=True,
        help_text="Optional environment classification (production, staging, testing, development)"
    )
    
    # Tags for flexible categorization (teams, apps, compliance, etc.)
    tags = models.ManyToManyField('DatabaseTag', related_name="databases", blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    is_demo = models.BooleanField(
        default=False,
        help_text="True for demo databases created via demo endpoints"
    )

    objects = WorkspaceScopedManager()

    class Meta:
        unique_together = [["workspace", "name"]]
        indexes = [
            models.Index(fields=["workspace", "is_active"]),
            models.Index(fields=["database_type"]),
            models.Index(fields=["environment"]),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.database_type}) in {self.workspace.slug}"


class DatabaseTag(UUIDModel):
    """
    Tags for categorizing databases (e.g., team, application, purpose).
    Tags are workspace-scoped and can be applied to multiple databases via M2M.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="database_tags")
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=20, blank=True, help_text="Optional color for UI display (e.g., hex code)")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = WorkspaceScopedManager()
    
    class Meta:
        unique_together = [["workspace", "name"]]
        indexes = [
            models.Index(fields=["workspace", "name"]),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.workspace.slug})"


class DatabaseAccount(UUIDModel):
    """
    An account defines a specific access level to a database (e.g., readonly, admin, restricted).
    Each account has its own credential containing the actual DB username/password.
    
    Access control in vault mode:
    - Credentials are encrypted for all approved device keys by default for simplicity
    - Access control is gated via database checks using the Access model
    - This allows approval flows (e.g., Slack notifications) without requiring admin's device key
    """
    database = models.ForeignKey(Database, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Credential containing DB user/password for this access level
    account_credential = models.ForeignKey(
        Credential,
        on_delete=models.CASCADE,
        related_name="accounts",
        null=True,
        blank=True,
        help_text="Credential containing DB username/password for this account"
    )
    
    # Optional: permissions/restrictions metadata
    permissions = models.JSONField(default=dict, blank=True, help_text="Account-specific permissions/restrictions")
    
    # Access level classification (for metadata and UI hints)
    access_level = models.CharField(
        max_length=20,
        choices=[(level.value, level.name) for level in AccountAccessLevel],
        default=AccountAccessLevel.READONLY.value,
        help_text="Access level classification (readonly, write, admin) - not enforced, for metadata/UI hints"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = [["database", "name"]]
        indexes = [
            models.Index(fields=["database", "is_active"]),
            models.Index(fields=["access_level"]),
        ]
    
    def __str__(self):
        return f"{self.name} account for {self.database.name}"


class Access(UUIDModel):
    """
    Tracks access control for accounts. Access can be granted to individual users or groups.
    
    In vault mode, credentials are encrypted for all approved device keys by default,
    but access is gated via these database records. This enables approval workflows
    (e.g., Slack notifications) without requiring the admin's device key for re-encryption.
    
    Workspace is denormalized for efficient querying and to prevent cross-workspace access grants.
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="access_grants",
        help_text="Workspace this access grant belongs to (denormalized from account)"
    )
    account = models.ForeignKey(DatabaseAccount, on_delete=models.CASCADE, related_name="access_grants")
    
    # Access can be for a user OR a group (exactly one must be set)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="account_access",
        null=True,
        blank=True,
        help_text="User with access (mutually exclusive with group)"
    )
    group = models.ForeignKey(
        UserGroup,
        on_delete=models.CASCADE,
        related_name="account_access",
        null=True,
        blank=True,
        help_text="Group with access (mutually exclusive with user)"
    )
    
    # Access tracking
    mode = models.CharField(
        max_length=20,
        choices=[(mode.value, mode.name) for mode in AccessMode],
        help_text="How this access was granted"
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="requested_access",
        null=True,
        blank=True,
        help_text="User who requested this access"
    )
    granted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="granted_access",
        null=True,
        blank=True,
        help_text="User who granted this access"
    )
    
    # Timestamps
    requested_at = models.DateTimeField(null=True, blank=True, help_text="When access was requested")
    granted_at = models.DateTimeField(null=True, blank=True, help_text="When access was granted")
    granted_until = models.DateTimeField(null=True, blank=True, help_text="Expiration time for temporary access")
    revoked_at = models.DateTimeField(null=True, blank=True, help_text="When access was revoked")
    revoked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="revoked_access",
        null=True,
        blank=True,
        help_text="User who revoked this access"
    )
    
    # Request details
    reason = models.TextField(blank=True, help_text="User-provided reason for requesting access")
    
    # Denial tracking
    denied_at = models.DateTimeField(null=True, blank=True, help_text="When access request was denied")
    denied_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="denied_access",
        null=True,
        blank=True,
        help_text="User who denied this access request"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceScopedManager()

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "user", "revoked_at"]),
            models.Index(fields=["workspace", "group", "revoked_at"]),
            models.Index(fields=["account", "revoked_at"]),
            models.Index(fields=["granted_until"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(user__isnull=False, group__isnull=True) |
                    models.Q(user__isnull=True, group__isnull=False)
                ),
                name="access_user_or_group_not_both"
            ),
        ]

    def clean(self):
        """Validate all User FKs and group belong to workspace."""
        super().clean()
        from django.core.exceptions import ValidationError

        if self.workspace_id:
            # Validate user FK
            if self.user_id and self.user.workspace_id != self.workspace_id:
                raise ValidationError(
                    f"Access user {self.user.email} is not in workspace {self.workspace.slug}"
                )

            # Validate group FK
            if self.group_id and self.group.workspace_id != self.workspace_id:
                raise ValidationError(
                    f"Access group {self.group.name} is not in workspace {self.workspace.slug}"
                )

            # Validate requested_by FK
            if self.requested_by_id and self.requested_by.workspace_id != self.workspace_id:
                raise ValidationError(
                    f"User {self.requested_by.email} who requested access is not in workspace {self.workspace.slug}"
                )

            # Validate granted_by FK
            if self.granted_by_id and self.granted_by.workspace_id != self.workspace_id:
                raise ValidationError(
                    f"User {self.granted_by.email} who granted access is not in workspace {self.workspace.slug}"
                )

            # Validate revoked_by FK
            if self.revoked_by_id and self.revoked_by.workspace_id != self.workspace_id:
                raise ValidationError(
                    f"User {self.revoked_by.email} who revoked access is not in workspace {self.workspace.slug}"
                )

            # Validate denied_by FK
            if self.denied_by_id and self.denied_by.workspace_id != self.workspace_id:
                raise ValidationError(
                    f"User {self.denied_by.email} who denied access is not in workspace {self.workspace.slug}"
                )

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        target = self.user.email if self.user else f"group:{self.group.name}"
        return f"Access to {self.account.name} for {target} ({self.mode})"


class AccountHealthLog(UUIDModel):
    """
    Track connection health for accounts to identify failing connections.
    
    Uses random sampling to reduce storage:
    - Success: 10% sample rate (1 in 10 logged)
    - Failure: 50% sample rate (1 in 2 logged)
    
    Sample rates are configurable via Django settings:
    - ACCOUNT_HEALTH_SUCCESS_SAMPLE_RATE (default: 0.1)
    - ACCOUNT_HEALTH_FAILURE_SAMPLE_RATE (default: 0.5)
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="account_health_logs"
    )
    database = models.ForeignKey(
        Database,
        on_delete=models.CASCADE,
        related_name="health_logs"
    )
    account = models.ForeignKey(
        DatabaseAccount,
        on_delete=models.CASCADE,
        related_name="health_logs"
    )
    success = models.BooleanField(
        help_text="True if connection succeeded, False if connectivity error"
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text="Error message if connection failed"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            # Primary index for failure rate calculation over time window
            models.Index(fields=["account", "created_at", "success"]),
            # For database-level health queries
            models.Index(fields=["database", "created_at", "success"]),
            # For workspace-level health queries
            models.Index(fields=["workspace", "created_at"]),
        ]
    
    def __str__(self):
        status = "success" if self.success else "failure"
        return f"Health log for {self.account.name}: {status} at {self.created_at}"
