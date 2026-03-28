from typing import List, Optional
from ninja import Router
from accounts.types import Request
from accounts.models import User
from vaultsql.api_policies import NotFound
from .models import Notification
from .schema import NotificationResponse, NotificationListResponse, CtaResponse


api_notification = Router()


def _notification_response(notification: Notification, user: User) -> NotificationResponse:
    """Convert Notification model to API response."""
    def _convert_ctas(ctas: Optional[List[dict]]) -> Optional[List[CtaResponse]]:
        if ctas is None:
            return None
        return [CtaResponse(**cta) for cta in ctas]
    
    # Notification is unread if:
    # - User has never opened notifications (notification_read_at is None), OR
    # - Notification was created after user last opened notifications
    unread = (
        user.notification_read_at is None or
        notification.created_at > user.notification_read_at
    )
    
    return NotificationResponse(
        id=str(notification.id),
        type=notification.type,
        event_id=notification.event_id,
        text_title=notification.text_title,
        text_short=notification.text_short,
        text_markdown=notification.text_markdown,
        text_slack=notification.text_slack,
        cta_email=_convert_ctas(notification.cta_email),
        cta_web=_convert_ctas(notification.cta_web),
        metadata=notification.metadata,
        skip_inbox=notification.skip_inbox,
        created_at=notification.created_at.isoformat(),
        queued_at=notification.queued_at.isoformat() if notification.queued_at else None,
        dispatched_at=notification.dispatched_at.isoformat() if notification.dispatched_at else None,
        slack_dispatched_at=notification.slack_dispatched_at.isoformat() if notification.slack_dispatched_at else None,
        email_dispatched_at=notification.email_dispatched_at.isoformat() if notification.email_dispatched_at else None,
        unread=unread,
    )


@api_notification.get("/", response=NotificationListResponse)
def list_notifications(request: Request):
    """Get all notifications for the current user (last 15).
    
    Filters out notifications with skip_inbox=True since they are
    displayed elsewhere (e.g., in dedicated inbox views, approval flows).
    """
    user = request.auth.user
    workspace = request.auth.workspace
    
    notifications = Notification.objects.filter(
        workspace=workspace,
        recipient=user,
        skip_inbox=False
    ).order_by("-created_at")[:15]
    
    return NotificationListResponse(
        notifications=[_notification_response(n, user) for n in notifications]
    )

