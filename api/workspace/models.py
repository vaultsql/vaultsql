"""Models for workspace app."""
from django.db import models
from accounts.models import UUIDModel, Workspace
from workspace.types import AuditEventType, AuditActorType, QueryActorType


class WorkspaceSettings(UUIDModel):
    """Per-workspace settings. One-to-one with Workspace."""
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="settings"
    )
    audit_enabled = models.BooleanField(
        default=True,
        help_text="When enabled, query events are logged to audit log"
    )
    audit_store_queries = models.BooleanField(
        default=False,
        help_text="When enabled, raw SQL queries are stored in audit logs"
    )
    allowed_email_domains = models.JSONField(
        default=list,
        help_text="List of email domains that can join without an invite code"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "workspace settings"

    def __str__(self):
        return f"Settings for {self.workspace.slug}"


class AuditLog(UUIDModel):
    """Audit log entry for workspace actions."""
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="audit_logs"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Actor info
    actor_type = models.CharField(
        max_length=20,
        choices=[(t.value, t.name) for t in AuditActorType]
    )
    actor_id = models.UUIDField(null=True, blank=True, help_text="User ID when actor_type=USER")
    actor_email = models.CharField(max_length=255, null=True, blank=True, help_text="Denormalized for CSV export")

    # Event
    event_type = models.CharField(
        max_length=50,
        choices=[(t.value, t.name) for t in AuditEventType]
    )

    # Query-specific fields (first-class since audit is query-driven)
    database_id = models.UUIDField(null=True, blank=True)
    database_name = models.CharField(max_length=200, null=True, blank=True, help_text="Denormalized")
    query_actor_type = models.CharField(
        max_length=20,
        choices=[(t.value, t.name) for t in QueryActorType],
        null=True,
        blank=True
    )
    query_hash = models.CharField(max_length=64, null=True, blank=True, help_text="SHA256 of query text")
    query_text = models.TextField(null=True, blank=True, help_text="Only stored if workspace.audit_store_queries=True")
    database = models.CharField(max_length=200, null=True, blank=True)

    # Flexible metadata for non-query events
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "created_at"]),
            models.Index(fields=["workspace", "event_type"]),
            models.Index(fields=["workspace", "actor_id"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event_type} by {self.actor_email or self.actor_type} at {self.created_at}"
