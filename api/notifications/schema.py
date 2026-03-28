from typing import Optional, List
from ninja import Schema


class CtaResponse(Schema):
    label: str
    primary: bool
    url: str


class NotificationResponse(Schema):
    id: str
    type: str
    event_id: str
    text_title: Optional[str] = None
    text_short: Optional[str] = None
    text_markdown: Optional[str] = None
    text_slack: Optional[str] = None
    cta_email: Optional[List[CtaResponse]] = None
    cta_web: Optional[List[CtaResponse]] = None
    metadata: Optional[dict] = None
    skip_inbox: bool
    created_at: str
    queued_at: Optional[str] = None
    dispatched_at: Optional[str] = None
    slack_dispatched_at: Optional[str] = None
    email_dispatched_at: Optional[str] = None
    unread: bool


class NotificationListResponse(Schema):
    notifications: list[NotificationResponse]

