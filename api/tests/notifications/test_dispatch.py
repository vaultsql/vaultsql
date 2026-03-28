import pytest
from unittest.mock import patch
from django.core.exceptions import ValidationError
from accounts.models import User, Workspace, WorkspaceRole, WorkspaceMode
from connection.models import UserKey
from notifications.dispatch import notification_dispatch
from notifications.builders import NewKeyNotificationBuilder
from notifications.models import Notification, NotificationType
from notifications.types import EmailCta, WebCta


@pytest.fixture
def workspace(db):
    return Workspace.objects.create(
        name="Test Workspace",
        slug="test-workspace",
        mode=WorkspaceMode.VAULT.value,
    )


@pytest.fixture
def admin_user(workspace):
    user = User.objects.create_user(
        email="admin@example.com",
        password="testpass123",
        workspace=workspace,
        role=WorkspaceRole.ADMIN.value,
    )
    user.identity.name = "Admin User"
    user.identity.save()
    return user


@pytest.fixture
def member_user(workspace):
    user = User.objects.create_user(
        email="member@example.com",
        password="testpass123",
        workspace=workspace,
        role=WorkspaceRole.MEMBER.value,
    )
    user.identity.name = "Member User"
    user.identity.save()
    return user


@pytest.fixture
def user_key(member_user, workspace):
    return UserKey.objects.create(
        workspace=workspace,
        user=member_user,
        public_key="test-public-key",
        private_key="test-private-key",
        passphrase_hint="test hint",
    )


class TestNotificationDispatch:
    @patch('notifications.dispatch.send_email')
    def test_dispatch_new_key_notification(self, mock_send_email, workspace, admin_user, user_key, member_user):
        """Test dispatching a new key notification."""
        builder = NewKeyNotificationBuilder(key=user_key)
        notification = notification_dispatch(workspace, admin_user, builder)
        
        assert notification.workspace == workspace
        assert notification.recipient == admin_user
        assert notification.type == NotificationType.NEW_KEY.value
        assert notification.event_id == f"new_key_{user_key.id}"
        assert notification.text_title == f"New Key Request from {member_user.name}"
        assert member_user.email in notification.text_markdown
        assert member_user.name in notification.text_markdown
        assert workspace.name in notification.text_markdown
    
    @patch('notifications.dispatch.send_email')
    def test_notification_uses_user_name_not_email(self, mock_send_email, workspace, admin_user, user_key):
        """Test that notification uses user.name instead of email in title."""
        builder = NewKeyNotificationBuilder(key=user_key)
        notification = notification_dispatch(workspace, admin_user, builder)
        
        # Title should use name, not email
        assert user_key.user.name in notification.text_title
        assert user_key.user.email not in notification.text_title.split("from")[1]
    
    @patch('notifications.dispatch.send_email')
    def test_notification_cta_structure(self, mock_send_email, workspace, admin_user, user_key):
        """Test that CTAs are stored as lists with proper structure."""
        builder = NewKeyNotificationBuilder(key=user_key)
        notification = notification_dispatch(workspace, admin_user, builder)
        
        # Web CTA should be a list
        assert isinstance(notification.cta_web, list)
        assert len(notification.cta_web) == 1
        web_cta = notification.cta_web[0]
        assert web_cta["label"] == "Review Key"
        assert web_cta["primary"] is True
        assert f"/keys/{user_key.id}/approve" in web_cta["url"]
    
    @patch('notifications.dispatch.send_email')
    def test_notification_metadata(self, mock_send_email, workspace, admin_user, user_key):
        """Test that metadata is stored correctly."""
        builder = NewKeyNotificationBuilder(key=user_key)
        notification = notification_dispatch(workspace, admin_user, builder)
        
        assert notification.metadata is not None
        assert notification.metadata["key_id"] == str(user_key.id)
        assert notification.metadata["user_id"] == str(user_key.user.id)
        assert notification.metadata["workspace_id"] == str(workspace.id)
    
    def test_notification_workspace_validation(self, workspace, admin_user, user_key):
        """Test that notification validates recipient belongs to workspace."""
        # Create a different workspace
        other_workspace = Workspace.objects.create(
            name="Other Workspace",
            slug="other-workspace",
            mode=WorkspaceMode.VAULT.value,
        )
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
            workspace=other_workspace,
            role=WorkspaceRole.ADMIN.value,
        )
        
        builder = NewKeyNotificationBuilder(key=user_key)
        
        # Should raise ValidationError when recipient is in different workspace
        with pytest.raises(ValidationError):
            notification_dispatch(workspace, other_user, builder)
    
    @patch('notifications.dispatch.send_email')
    def test_multiple_notifications_same_event_id(self, mock_send_email, workspace, admin_user, user_key):
        """Test that multiple notifications can share the same event_id."""
        builder = NewKeyNotificationBuilder(key=user_key)
        
        # Create two notifications with same event_id (different recipients)
        notification1 = notification_dispatch(workspace, admin_user, builder)
        
        # Create another admin user in same workspace
        admin_user2 = User.objects.create_user(
            email="admin2@example.com",
            password="testpass123",
            workspace=workspace,
            role=WorkspaceRole.ADMIN.value,
        )
        admin_user2.identity.name = "Admin2 User"
        admin_user2.identity.save()
        notification2 = notification_dispatch(workspace, admin_user2, builder)
        
        assert notification1.event_id == notification2.event_id
        assert notification1.recipient != notification2.recipient


class TestNewKeyNotificationBuilder:
    def test_builder_methods(self, user_key):
        """Test that builder methods return correct values."""
        builder = NewKeyNotificationBuilder(key=user_key)
        
        assert builder.get_type() == NotificationType.NEW_KEY
        assert builder.get_event_id() == f"new_key_{user_key.id}"
        assert user_key.user.name in builder.get_text_title()
        assert user_key.user.name in builder.get_text_short()
        assert user_key.user.name in builder.get_text_markdown()
        
        web_ctas = builder.get_cta_web()
        assert web_ctas is not None
        assert len(web_ctas) == 1
        assert isinstance(web_ctas[0], WebCta)
        assert web_ctas[0].label == "Review Key"
        assert web_ctas[0].primary is True
        
        # Test skip_inbox
        assert builder.skip_inbox() is True
        
        # Test get_email_html
        email_html = builder.get_email_html()
        assert email_html is not None
        assert user_key.user.email in email_html
        assert user_key.workspace.name in email_html
    
    def test_builder_cta_urls_contain_path(self, user_key):
        """Test that CTA URLs contain the correct path."""
        builder = NewKeyNotificationBuilder(key=user_key)
        
        web_ctas = builder.get_cta_web()
        assert f"/keys/{user_key.id}/approve" in web_ctas[0].url
        assert web_ctas[0].url.startswith("http")
