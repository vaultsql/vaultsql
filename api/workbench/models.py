from django.db import models
from accounts.models import UUIDModel, User, Workspace
from accounts.managers import WorkspaceScopedManager
from connection.models import Database


class Folder(UUIDModel):
    """
    A folder for organizing worksheets. Private to a user within a workspace.
    Associated with a specific database.
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="workbench_folders",
        help_text="Workspace this folder belongs to (denormalized from user)"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="workbench_folders",
        help_text="Owner of this folder"
    )
    database = models.ForeignKey(
        Database,
        on_delete=models.CASCADE,
        null=True,  # Nullable in DB for migration, but required in API
        blank=True,
        related_name="folders",
        help_text="Database this folder is associated with"
    )
    name = models.CharField(max_length=200)
    position = models.IntegerField(default=0, help_text="Order position for display")
    # For future nested folders support
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        help_text="Parent folder (for future nested folders)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceScopedManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user", "database", "name"],
                name="workbench_folder_unique_name_per_database"
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "user"]),
            models.Index(fields=["user", "database", "position"]),
            models.Index(fields=["database"]),
            models.Index(fields=["parent"]),  # For future nested folders
        ]

    def clean(self):
        """Validate user belongs to workspace."""
        super().clean()
        if self.user_id and self.workspace_id:
            if self.user.workspace_id != self.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    f"User {self.user.email} is not in workspace"
                )

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.user.email})"


class Worksheet(UUIDModel):
    """
    A SQL worksheet/document. Private to a user within a workspace.
    Associated with a specific database.
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="worksheets",
        help_text="Workspace this worksheet belongs to (denormalized from user)"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="worksheets",
        help_text="Owner of this worksheet"
    )
    database = models.ForeignKey(
        Database,
        on_delete=models.CASCADE,
        null=True,  # Nullable in DB for migration, but required in API
        blank=True,
        related_name="worksheets",
        help_text="Database this worksheet is associated with"
    )
    folder = models.ForeignKey(
        Folder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="worksheets",
        help_text="Containing folder (null = root level)"
    )
    name = models.CharField(max_length=200)
    content = models.TextField(blank=True, default="", help_text="SQL content")
    position = models.IntegerField(default=0, help_text="Order position within folder")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceScopedManager()

    class Meta:
        constraints = [
            # Allow same name in different folders/databases
            models.UniqueConstraint(
                fields=["workspace", "user", "database", "folder", "name"],
                name="workbench_worksheet_unique_name_per_database_folder"
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "user"]),
            models.Index(fields=["user", "database", "folder", "position"]),
            models.Index(fields=["database"]),
            models.Index(fields=["folder"]),
        ]

    def clean(self):
        """Validate user belongs to workspace and folder belongs to same user."""
        super().clean()
        from django.core.exceptions import ValidationError

        if self.user_id and self.workspace_id:
            if self.user.workspace_id != self.workspace_id:
                raise ValidationError(
                    f"User {self.user.email} is not in workspace"
                )

        if self.folder_id and self.user_id:
            if self.folder.user_id != self.user_id:
                raise ValidationError(
                    "Worksheet folder must belong to the same user"
                )

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        folder_name = self.folder.name if self.folder else "root"
        return f"{self.name} in {folder_name} ({self.user.email})"


class WorksheetVersion(UUIDModel):
    """
    Version history for worksheets. Automatically created on save.
    Uses logarithmic culling to keep ~10 versions.
    """
    worksheet = models.ForeignKey(
        Worksheet,
        on_delete=models.CASCADE,
        related_name="versions"
    )
    content = models.TextField(help_text="Snapshot of worksheet content")
    version_number = models.IntegerField(help_text="Incrementing version number")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["worksheet", "created_at"]),
            models.Index(fields=["worksheet", "version_number"]),
        ]
        ordering = ["-version_number"]

    def __str__(self):
        return f"v{self.version_number} of {self.worksheet.name}"
