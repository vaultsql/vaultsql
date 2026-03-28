import hashlib
import uuid
from datetime import datetime
from enum import Enum
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from .managers import WorkspaceScopedManager


def get_gravatar_url(email: str, size: int = 200) -> str:
    """Generate a Gravatar URL for an email address.
    
    Uses the 'identicon' default which generates a unique geometric pattern
    based on the email hash if no Gravatar exists.
    
    Args:
        email: The email address to generate a Gravatar URL for
        size: The size of the image in pixels (default 200)
    
    Returns:
        The Gravatar URL
    """
    email_hash = hashlib.md5(email.lower().strip().encode('utf-8')).hexdigest()
    return f"https://www.gravatar.com/avatar/{email_hash}?s={size}&d=identicon"


class Identity(models.Model):
    """Cross-workspace identity for authentication.

    Identity represents a person's authentication credentials (email + password).
    One Identity can have multiple User accounts (one per workspace they belong to).

    IMPORTANT: Authentication happens at the Identity level.
    - Identity stores email and password (hashed)
    - Identity is used for login/signup
    - After authentication, user selects/switches between their workspace-scoped Users

    Example flow:
    1. Signup: Create Identity(email, password) -> get identity-only session token
    2. Join/Create workspace: Create User(identity, workspace, role) -> get workspace session
    3. Login: Verify Identity credentials -> return workspace session if User exists,
              otherwise return identity-only session

    This design supports future multi-workspace access while keeping workspace data isolated.
    """
    email = models.EmailField(unique=True, db_index=True)
    password = models.CharField(max_length=128)
    name = models.CharField(max_length=300, blank=True)
    image_url = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "identities"

    def __str__(self):
        return self.email

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password)


class LoginCode(models.Model):
    """Login code for passwordless authentication.

    Login codes are sent to a user's email and used to create a session.
    Unlike PasswordResetToken, LoginCode is not tied to a User/Workspace,
    only to an email address (Identity level).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)  # 6-digit numeric code
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["email", "code"]),
            models.Index(fields=["expires_at"]),
            models.Index(fields=["created_at"]),
        ]

    def is_valid(self) -> bool:
        """Check if code is still valid (not expired, not used)."""
        from django.utils import timezone
        return (
            self.verified_at is None and
            self.expires_at > timezone.now()
        )

    def mark_verified(self):
        """Mark code as verified."""
        from django.utils import timezone
        self.verified_at = timezone.now()
        self.save(update_fields=["verified_at"])

    @staticmethod
    def generate_login_code(email: str, ip_address: str = None) -> "LoginCode":
        """Generate a new login code for an email address.

        Args:
            email: Email address to send code to
            ip_address: Optional IP address for security tracking

        Returns:
            LoginCode instance
        """
        import secrets
        from datetime import timedelta
        from django.utils import timezone

        # Generate 6-digit code
        code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])

        # 10 minute expiry
        expires_at = timezone.now() + timedelta(minutes=10)

        return LoginCode.objects.create(
            email=email.lower(),  # Normalize email
            code=code,
            expires_at=expires_at,
            ip_address=ip_address,
        )

    def __str__(self):
        return f"LoginCode for {self.email} - {self.code}"


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class UserQuerySet(models.QuerySet):
    """QuerySet for User with active filtering."""

    def active(self):
        """Filter to only active (non-deactivated) users."""
        return self.filter(deactivated_at__isnull=True)


class UserManager(BaseUserManager):
    """Manager for workspace-scoped User model.

    NOTE: Password handling happens at Identity level, not User level.
    Users are created for existing identities when they join workspaces.

    This manager automatically excludes deactivated users from all queries.
    Use User.all_objects for queries that need to include deactivated users.
    """

    use_in_migrations = True

    def get_queryset(self):
        """Return only active users by default."""
        return UserQuerySet(self.model, using=self._db).active()

    def _create_user(self, email, password, workspace, **extra_fields):
        """Create and save a User with the given email.

        Args:
            email: User's email address (used to get/create Identity)
            password: Password for the Identity (only used if creating new Identity)
            workspace: Workspace instance this user belongs to
            **extra_fields: Additional fields (role, is_staff, etc.)
        """
        if not email:
            raise ValueError("The given email must be set")
        if not workspace:
            raise ValueError("The given workspace must be set")

        email = self.normalize_email(email)

        # Get or create Identity (password only matters if creating new identity)
        identity, created = Identity.objects.get_or_create(email=email)
        if created and password:
            identity.set_password(password)
            identity.save()

        # Create workspace-scoped user
        user = self.model(
            identity=identity,
            workspace=workspace,
            email=email,  # Denormalized for convenience
            **extra_fields
        )
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, workspace=None, **extra_fields):
        """Create and save a regular User with the given email."""
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", WorkspaceRole.MEMBER.value)
        return self._create_user(email, password, workspace, **extra_fields)

    def create_superuser(self, email, password, workspace=None, **extra_fields):
        """Create and save a SuperUser with the given email and password.

        For management commands, workspace can be None and will create a default workspace.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", WorkspaceRole.ADMIN.value)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # Create default workspace for superuser if not provided
        if workspace is None:
            from django.utils.text import slugify
            workspace, _ = Workspace.objects.get_or_create(
                slug="admin",
                defaults={"name": "Admin Workspace"}
            )

        return self._create_user(email, password, workspace, **extra_fields)


class AllUsersManager(BaseUserManager):
    """Manager that includes deactivated users.

    Use this for admin operations that need to access deactivated users,
    such as reactivation or audit queries.
    """

    def get_queryset(self):
        """Return all users including deactivated ones."""
        return UserQuerySet(self.model, using=self._db)


class WorkspaceRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"


class User(UUIDModel, AbstractUser):
    """Workspace-scoped user account.

    IMPORTANT: User is tied to a specific workspace. Each User belongs to exactly one workspace.
    Authentication happens at the Identity level (see Identity model above).
    One Identity can have multiple Users (one per workspace they belong to).

    Example:
    - alice@example.com creates an Identity during signup
    - Alice joins WorkspaceA -> creates User(identity=alice, workspace=WorkspaceA)
    - Alice joins WorkspaceB -> creates User(identity=alice, workspace=WorkspaceB)
    - Alice logs in once with her Identity credentials, then can switch between workspaces

    User stores workspace-specific information like role, preferences, and metadata.
    Password and authentication credentials live on Identity, not User.
    """
    objects = UserManager()  # Default: excludes deactivated users
    all_objects = AllUsersManager()  # Admin: includes all users

    USERNAME_FIELD = "id"
    REQUIRED_FIELDS = ["email"]

    # Disable Django auth fields - authentication happens at Identity level
    username = None
    password = None

    identity = models.ForeignKey(
        Identity,
        on_delete=models.CASCADE,
        related_name="users",
        help_text="External identity (email, social login). Authentication happens here."
    )
    workspace = models.ForeignKey(
        "Workspace",  # Forward reference since Workspace defined later
        on_delete=models.CASCADE,
        related_name="users",
        help_text="Workspace this user belongs to. Each User is scoped to one workspace."
    )
    email = models.EmailField()  # Denormalized from identity for convenience
    role = models.CharField(
        max_length=20,
        choices=[(role.value, role.name) for role in WorkspaceRole],
        default=WorkspaceRole.MEMBER.value,
        help_text="User's role in this workspace"
    )
    notification_read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time user opened notifications. Used to calculate unread count."
    )
    deactivated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When set, the user is deactivated in this workspace and cannot access it."
    )

    class Meta:
        unique_together = [["identity", "workspace"]]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "email"],
                name="accounts_user_workspace_email_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "email"]),
            models.Index(fields=["workspace", "role"]),
        ]

    @property
    def display(self) -> str:
        return self.identity.name or self.email

    @property
    def name(self) -> str:
        return self.identity.name or self.email

    def __str__(self):
        return f"{self.email} ({self.workspace.slug})"


class WorkspaceMode(str, Enum):
    VAULT = "vault"
    STREAMLINED = "streamlined"
    MANAGED = "managed"
    BYOK = "byok"  # Bring Your Own Key


class Workspace(UUIDModel):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True)
    mode = models.CharField(
        max_length=20,
        choices=[(mode.value, mode.name) for mode in WorkspaceMode],
        default=WorkspaceMode.STREAMLINED.value,
        help_text="Vault: users manage keypairs. Streamlined: centralized credential management. BYOK: bring your own key"
    )
    image_url = models.URLField(max_length=500, blank=True, null=True)
    referrer = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class ImageBlob(UUIDModel):
    class StorageBackend(str, Enum):
        DB = "db"
        S3 = "s3"

    storage_backend = models.CharField(
        max_length=20,
        choices=[(backend.value, backend.name) for backend in StorageBackend],
    )
    content_type = models.CharField(max_length=100)
    byte_size = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64, db_index=True)
    blob_data = models.BinaryField(null=True, blank=True)
    object_key = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["storage_backend", "created_at"]),
        ]

    def __str__(self):
        return f"{self.id} ({self.storage_backend})"


class UserGroup(UUIDModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="groups")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
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


class GroupMembership(UUIDModel):
    group = models.ForeignKey(UserGroup, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="group_memberships")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["group", "user"]]
        indexes = [
            models.Index(fields=["group", "user"]),
        ]

    def clean(self):
        """Validate user belongs to group's workspace."""
        super().clean()
        if self.user_id and self.group_id:
            if self.user.workspace_id != self.group.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    f"User {self.user.email} is not in workspace {self.group.workspace.slug}"
                )

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} -> {self.group.name}"


class Session(UUIDModel):
    """Authentication session for an identity.

    Session.workspace is denormalized from user.workspace for query performance.
    Session.role is denormalized from user.role for permission checks.
    """
    identity = models.ForeignKey(
        Identity,
        on_delete=models.CASCADE,
        related_name="sessions",
        help_text="External identity associated with this session",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sessions",
        null=True,
        blank=True,
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Denormalized from user.workspace for performance",
    )
    token = models.CharField(max_length=64, unique=True)
    role = models.CharField(
        max_length=20,
        choices=[(role.value, role.name) for role in WorkspaceRole],
        null=True,
        blank=True,
        help_text="Denormalized from user.role for performance",
    )
    expiry = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "token"]),
            models.Index(fields=["expiry"]),
        ]

    def clean(self):
        """Validate session identity/workspace/role consistency."""
        super().clean()
        if self.user_id:
            if self.identity_id != self.user.identity_id:
                from django.core.exceptions import ValidationError
                raise ValidationError("Session identity must match user's identity")
            if self.workspace_id != self.user.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError("Session workspace must match user's workspace")
            if self.role != self.user.role:
                from django.core.exceptions import ValidationError
                raise ValidationError("Session role must match user's role")
        else:
            if self.workspace_id or self.role:
                from django.core.exceptions import ValidationError
                raise ValidationError("Workspace sessions require a user")

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)


class MagicLink(UUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="magic_links")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="magic_links")
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    is_valid = models.BooleanField(default=True)

    objects = WorkspaceScopedManager()

    class Meta:
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["expires_at"]),
            models.Index(fields=["workspace", "user"]),
        ]

    def clean(self):
        """Validate user belongs to workspace."""
        super().clean()
        if self.user_id and self.workspace_id:
            if self.user.workspace_id != self.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError("MagicLink workspace must match user's workspace")

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)


class SocialProvider(str, Enum):
    GOOGLE = "google"
    GITHUB = "github"
    MICROSOFT = "microsoft"


class SocialAccount(UUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="social_accounts")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="social_accounts")
    provider = models.CharField(
        max_length=20,
        choices=[(provider.value, provider.name) for provider in SocialProvider]
    )
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField()
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceScopedManager()

    class Meta:
        unique_together = [["workspace", "provider", "provider_user_id"]]
        indexes = [
            models.Index(fields=["provider", "provider_user_id"]),
            models.Index(fields=["workspace", "user"]),
        ]

    def clean(self):
        """Validate user belongs to workspace."""
        super().clean()
        if self.user_id and self.workspace_id:
            if self.user.workspace_id != self.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError("SocialAccount workspace must match user's workspace")

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} - {self.provider} ({self.workspace.slug})"


class PasswordResetToken(UUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    invalid_at = models.DateTimeField(null=True, blank=True)

    objects = WorkspaceScopedManager()

    class Meta:
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["expires_at"]),
            models.Index(fields=["workspace", "user"]),
        ]

    def clean(self):
        """Validate user belongs to workspace."""
        super().clean()
        if self.user_id and self.workspace_id:
            if self.user.workspace_id != self.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError("PasswordResetToken workspace must match user's workspace")

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)


class WorkspaceInvitation(UUIDModel):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="invitations")
    token = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="When set, invitation expires at this time")
    max_uses = models.IntegerField(null=True, blank=True, help_text="Maximum number of times this invitation can be used")
    use_count = models.IntegerField(default=0, help_text="Number of times this invitation has been used")
    created_by = models.ForeignKey(
        "User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invitations",
        help_text="User who created this invitation"
    )

    objects = WorkspaceScopedManager()

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "revoked_at"]),
            models.Index(fields=["token"]),
            models.Index(fields=["expires_at"]),
        ]

    def is_valid(self) -> bool:
        """Check if invitation is still valid (not revoked, not expired, not exhausted)."""
        from django.utils import timezone
        if self.revoked_at is not None:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        if self.max_uses is not None and self.use_count >= self.max_uses:
            return False
        return True

    def __str__(self):
        return f"Invitation for {self.workspace.slug}"


class InvitationUsage(UUIDModel):
    """Track who used which invitation."""
    invitation = models.ForeignKey(
        WorkspaceInvitation,
        on_delete=models.CASCADE,
        related_name="usages"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="invitation_usages"
    )
    used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["invitation", "used_at"]),
            models.Index(fields=["user", "used_at"]),
        ]
        ordering = ["-used_at"]

    def __str__(self):
        return f"{self.user.email} used invitation {self.invitation.token} at {self.used_at}"
