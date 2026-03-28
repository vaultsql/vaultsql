from typing import List, Optional
from accounts.models import User, Workspace
from .models import Notification
from .builders import NotificationBuilder
from .types import EmailCta, WebCta
from .email import send_email


def _serialize_ctas(ctas: Optional[List]) -> Optional[List[dict]]:
    """Convert list of CTA Pydantic models to list of dicts for JSON storage."""
    if ctas is None:
        return None
    return [cta.model_dump() for cta in ctas]


def notification_dispatch(workspace: Workspace, recipient: User, builder: NotificationBuilder) -> Notification:
    """Dispatch a notification using the provided builder.
    
    Args:
        workspace: The workspace this notification belongs to
        recipient: The user who will receive the notification
        builder: A builder instance that provides all notification content
    
    Returns:
        The created Notification instance
    """
    notification = Notification(
        workspace=workspace,
        recipient=recipient,
        type=builder.get_type().value,
        event_id=builder.get_event_id(),
        text_title=builder.get_text_title(),
        text_short=builder.get_text_short(),
        text_markdown=builder.get_text_markdown(),
        text_slack=builder.get_text_slack(),
        cta_email=_serialize_ctas(builder.get_cta_email()),
        cta_web=_serialize_ctas(builder.get_cta_web()),
        metadata=builder.get_metadata(),
        skip_inbox=builder.skip_inbox(),
    )
    notification.save()
    
    # Send email if builder provides HTML
    email_html = builder.get_email_html()
    if email_html:
        content_text = notification.text_short or notification.text_markdown or ""
        send_email(
            to=recipient.email,
            subject=notification.text_title or "Notification",
            content_html=email_html,
            content_text=content_text,
        )
    
    return notification

