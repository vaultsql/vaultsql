from abc import ABC, abstractmethod
from typing import Optional, List, TYPE_CHECKING
from accounts.models import User, Workspace
from connection.models import UserKey
from .models import NotificationType
from .types import EmailCta, WebCta
from .utils import build_frontend_url
from .email.renderer import load_email_html
from .email.markdown import markdown_to_html

if TYPE_CHECKING:
    from connection.models import Access


class NotificationBuilder(ABC):
    """Base class for notification builders. Each builder knows how to construct
    notification content from its specific context (e.g., a new key, access request, etc.).
    """
    
    @abstractmethod
    def get_type(self) -> NotificationType:
        """Return the notification type."""
        pass
    
    @abstractmethod
    def get_event_id(self) -> str:
        """Return a unique event identifier for deduplication."""
        pass
    
    def get_text_title(self) -> Optional[str]:
        """Return the notification title/heading."""
        return None
    
    def get_text_short(self) -> Optional[str]:
        """Return a short summary text."""
        return None
    
    def get_text_markdown(self) -> Optional[str]:
        """Return full markdown-formatted content."""
        return None
    
    def get_text_slack(self) -> Optional[str]:
        """Return Slack-formatted content."""
        return None
    
    def get_cta_email(self) -> Optional[List[EmailCta]]:
        """Return list of email CTAs."""
        return None
    
    def get_cta_web(self) -> Optional[List[WebCta]]:
        """Return list of web/in-app CTAs."""
        return None
    
    def get_metadata(self) -> Optional[dict]:
        """Return additional metadata."""
        return None
    
    def get_email_html(self) -> Optional[str]:
        """Return full HTML for email body. Each notification builds its own."""
        return None
    
    def skip_inbox(self) -> bool:
        """Return True to skip showing in transactional inbox.
        
        Default is True since most notifications are displayed elsewhere
        (e.g., in dedicated inbox views, approval flows, etc.).
        """
        return True


class NewKeyNotificationBuilder(NotificationBuilder):
    """Builder for notifications about a new user key that needs admin approval."""
    
    def __init__(self, key: UserKey):
        self.key = key
    
    def get_type(self) -> NotificationType:
        return NotificationType.NEW_KEY
    
    def get_event_id(self) -> str:
        return f"new_key_{self.key.id}"
    
    def get_text_title(self) -> Optional[str]:
        return f"New Key Request from {self.key.user.name}"
    
    def get_text_short(self) -> Optional[str]:
        return f"{self.key.user.name} has requested a new encryption key"
    
    def get_text_markdown(self) -> Optional[str]:
        user = self.key.user
        return f"""# New Key Request

**User:** {user.name} ({user.email})
**Workspace:** {self.key.workspace.name}
**Created:** {self.key.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}
**Passphrase Hint:** {self.key.passphrase_hint or 'Not provided'}

This key requires admin approval before it can be used to encrypt credentials.
"""
    
    def get_cta_web(self) -> Optional[List[WebCta]]:
        return [
            WebCta(
                label="Review Key",
                primary=True,
                url=build_frontend_url(f"/keys/{self.key.id}/approve")
            )
        ]
    
    def get_metadata(self) -> Optional[dict]:
        return {
            "key_id": str(self.key.id),
            "user_id": str(self.key.user.id),
            "workspace_id": str(self.key.workspace.id),
            "created_at": self.key.created_at.isoformat(),
        }
    
    def get_email_html(self) -> Optional[str]:
        """Use React Email template for key approval request."""
        requester_name = self.key.user.name or self.key.user.email
        
        inbox_url = build_frontend_url('/inbox/')
        
        return load_email_html('key-approval-request', {
            'requesterName': requester_name,
            'requesterEmail': self.key.user.email,
            'workspaceName': self.key.workspace.name,
            'inboxUrl': inbox_url,
        })


class AccessRequestedNotificationBuilder(NotificationBuilder):
    """Builder for notifications when a user requests access to an account.
    Sent to workspace admins.
    """
    
    def __init__(self, access: "Access"):
        self.access = access
    
    def get_type(self) -> NotificationType:
        return NotificationType.ACCESS_REQUESTED
    
    def get_event_id(self) -> str:
        return f"access_requested_{self.access.id}"
    
    def get_text_title(self) -> Optional[str]:
        requester = self.access.requested_by
        account = self.access.account
        return f"Access Request from {requester.name}"
    
    def get_text_short(self) -> Optional[str]:
        requester = self.access.requested_by
        account = self.access.account
        database = account.database
        return f"{requester.name} is requesting access to {account.name} on {database.name}"
    
    def get_text_markdown(self) -> Optional[str]:
        requester = self.access.requested_by
        account = self.access.account
        database = account.database
        reason = self.access.reason or "No reason provided"
        requested_at = self.access.requested_at.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.requested_at else "N/A"
        granted_until = self.access.granted_until.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.granted_until else "Permanent"
        
        return f"""# Access Request

**Requester:** {requester.name} ({requester.email})
**Database:** {database.name}
**Account:** {account.name}
**Requested At:** {requested_at}
**Access Until:** {granted_until}

**Reason:** {reason}

Please review this access request in the Inbox.
"""
    
    def get_cta_web(self) -> Optional[List[WebCta]]:
        return [
            WebCta(
                label="Review Request",
                primary=True,
                url=build_frontend_url("/inbox")
            )
        ]
    
    def get_metadata(self) -> Optional[dict]:
        return {
            "access_id": str(self.access.id),
            "account_id": str(self.access.account.id),
            "account_name": self.access.account.name,
            "database_id": str(self.access.account.database.id),
            "database_name": self.access.account.database.name,
            "requester_id": str(self.access.requested_by.id),
            "requester_email": self.access.requested_by.email,
        }
    
    def get_email_html(self) -> Optional[str]:
        """Use React Email template for access requested notification."""
        requester = self.access.requested_by
        account = self.access.account
        database = account.database
        reason = self.access.reason or ""
        granted_until = self.access.granted_until.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.granted_until else "Permanent"
        inbox_url = build_frontend_url('/inbox')
        
        return load_email_html('access-requested', {
            'requesterName': requester.name,
            'requesterEmail': requester.email,
            'serverName': database.name,
            'profileName': account.name,
            'reason': reason,
            'grantedUntil': granted_until,
            'inboxUrl': inbox_url,
        })


class AccessApprovedNotificationBuilder(NotificationBuilder):
    """Builder for notifications when an access request is approved.
    Sent to the requester.
    """
    
    def __init__(self, access: "Access"):
        self.access = access
    
    def get_type(self) -> NotificationType:
        return NotificationType.ACCESS_APPROVED
    
    def get_event_id(self) -> str:
        return f"access_approved_{self.access.id}"
    
    def get_text_title(self) -> Optional[str]:
        account = self.access.account
        return f"Access Approved: {account.name}"
    
    def get_text_short(self) -> Optional[str]:
        account = self.access.account
        database = account.database
        return f"Your access request to {account.name} on {database.name} has been approved"
    
    def get_text_markdown(self) -> Optional[str]:
        account = self.access.account
        database = account.database
        granted_by = self.access.granted_by
        granted_at = self.access.granted_at.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.granted_at else "N/A"
        granted_until = self.access.granted_until.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.granted_until else "Permanent"
        
        return f"""# Access Approved

Your access request has been approved!

**Database:** {database.name}
**Account:** {account.name}
**Approved By:** {granted_by.name if granted_by else 'System'}
**Approved At:** {granted_at}
**Access Until:** {granted_until}

You can now connect to this account.
"""
    
    def get_cta_web(self) -> Optional[List[WebCta]]:
        return [
            WebCta(
                label="View Accounts",
                primary=True,
                url=build_frontend_url("/")
            )
        ]
    
    def get_metadata(self) -> Optional[dict]:
        return {
            "access_id": str(self.access.id),
            "account_id": str(self.access.account.id),
            "account_name": self.access.account.name,
            "database_id": str(self.access.account.database.id),
            "database_name": self.access.account.database.name,
            "granted_by_id": str(self.access.granted_by.id) if self.access.granted_by else None,
        }
    
    def get_email_html(self) -> Optional[str]:
        """Use React Email template for access approved notification."""
        account = self.access.account
        database = account.database
        granted_by = self.access.granted_by
        granted_at = self.access.granted_at.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.granted_at else "N/A"
        granted_until = self.access.granted_until.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.granted_until else "Permanent"
        dashboard_url = build_frontend_url('/')
        
        return load_email_html('access-approved', {
            'serverName': database.name,
            'profileName': account.name,
            'approvedBy': granted_by.name if granted_by else 'System',
            'approvedAt': granted_at,
            'accessUntil': granted_until,
            'dashboardUrl': dashboard_url,
        })


class AccessDeniedNotificationBuilder(NotificationBuilder):
    """Builder for notifications when an access request is denied.
    Sent to the requester.
    """
    
    def __init__(self, access: "Access"):
        self.access = access
    
    def get_type(self) -> NotificationType:
        return NotificationType.ACCESS_DENIED
    
    def get_event_id(self) -> str:
        return f"access_denied_{self.access.id}"
    
    def get_text_title(self) -> Optional[str]:
        account = self.access.account
        return f"Access Denied: {account.name}"
    
    def get_text_short(self) -> Optional[str]:
        account = self.access.account
        database = account.database
        return f"Your access request to {account.name} on {database.name} has been denied"
    
    def get_text_markdown(self) -> Optional[str]:
        account = self.access.account
        database = account.database
        denied_by = self.access.denied_by
        denied_at = self.access.denied_at.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.denied_at else "N/A"
        
        return f"""# Access Denied

Your access request has been denied.

**Database:** {database.name}
**Account:** {account.name}
**Denied By:** {denied_by.name if denied_by else 'System'}
**Denied At:** {denied_at}

Please contact your workspace administrator if you believe this was in error.
"""
    
    def get_cta_web(self) -> Optional[List[WebCta]]:
        return [
            WebCta(
                label="View Accounts",
                primary=True,
                url=build_frontend_url("/")
            )
        ]
    
    def get_metadata(self) -> Optional[dict]:
        return {
            "access_id": str(self.access.id),
            "account_id": str(self.access.account.id),
            "account_name": self.access.account.name,
            "database_id": str(self.access.account.database.id),
            "database_name": self.access.account.database.name,
            "denied_by_id": str(self.access.denied_by.id) if self.access.denied_by else None,
        }
    
    def get_email_html(self) -> Optional[str]:
        """Use React Email template for access denied notification."""
        account = self.access.account
        database = account.database
        denied_by = self.access.denied_by
        denied_at = self.access.denied_at.strftime('%Y-%m-%d %H:%M:%S UTC') if self.access.denied_at else "N/A"
        dashboard_url = build_frontend_url('/')
        
        return load_email_html('access-denied', {
            'serverName': database.name,
            'profileName': account.name,
            'deniedBy': denied_by.name if denied_by else 'System',
            'deniedAt': denied_at,
            'dashboardUrl': dashboard_url,
        })

