from enum import Enum
from django.db import models
from accounts.models import UUIDModel, User, Workspace
from accounts.managers import WorkspaceScopedManager


class NotificationType(str, Enum):
    NEW_KEY = "new_key"
    ACCESS_REQUESTED = "access_requested"
    ACCESS_APPROVED = "access_approved"
    ACCESS_DENIED = "access_denied"


class Notification(UUIDModel):
    """
    Notification for a user. Notifications can be dispatched via multiple channels
    (email, Slack, in-app) and tracked separately per channel.
    """
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="notifications",
        help_text="Workspace this notification belongs to"
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        help_text="User who receives this notification"
    )
    type = models.CharField(
        max_length=50,
        choices=[(ntype.value, ntype.name) for ntype in NotificationType],
        help_text="Type of notification"
    )
    event_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Event identifier for deduplication (multiple notifications can share same event_id)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    queued_at = models.DateTimeField(null=True, blank=True, help_text="When notification was queued for dispatch")
    dispatched_at = models.DateTimeField(null=True, blank=True, help_text="When notification was dispatched (any channel)")
    slack_dispatched_at = models.DateTimeField(null=True, blank=True, help_text="When notification was dispatched via Slack")
    email_dispatched_at = models.DateTimeField(null=True, blank=True, help_text="When notification was dispatched via email")
    
    # Content fields
    text_title = models.CharField(max_length=255, null=True, blank=True, help_text="Title/heading for the notification")
    text_short = models.CharField(max_length=500, null=True, blank=True, help_text="Short summary text")
    text_markdown = models.TextField(null=True, blank=True, help_text="Full markdown-formatted content")
    text_slack = models.TextField(null=True, blank=True, help_text="Slack-formatted content")
    
    # Call-to-action fields (JSON) - stored as lists of CTA objects
    cta_email = models.JSONField(null=True, blank=True, default=list, help_text="List of email CTAs (each with label, primary, url)")
    cta_web = models.JSONField(null=True, blank=True, default=list, help_text="List of web/in-app CTAs (each with label, primary, url)")
    
    # Additional metadata
    metadata = models.JSONField(null=True, blank=True, default=dict, help_text="Additional structured data for the notification")
    
    # Inbox visibility
    skip_inbox = models.BooleanField(default=False, help_text="If True, notification won't appear in transactional inbox")
    
    objects = WorkspaceScopedManager()
    
    class Meta:
        indexes = [
            models.Index(fields=["workspace", "recipient", "created_at"]),
            models.Index(fields=["recipient", "created_at"]),
            models.Index(fields=["event_id"]),
            models.Index(fields=["type", "created_at"]),
        ]
    
    def clean(self):
        """Validate recipient belongs to workspace."""
        super().clean()
        if self.recipient_id and self.workspace_id:
            if self.recipient.workspace_id != self.workspace_id:
                from django.core.exceptions import ValidationError
                raise ValidationError(
                    f"Recipient {self.recipient.email} is not in workspace {self.workspace.slug}"
                )
    
    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Notification {self.type} for {self.recipient.email} ({self.workspace.slug})"

