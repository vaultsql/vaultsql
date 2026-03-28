#!/usr/bin/env python
"""Script to test notification dispatch with Postmark."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vaultsql.settings.dev')
django.setup()

from django.conf import settings

from accounts.models import Workspace, User, WorkspaceRole, WorkspaceMode
from connection.models import UserKey
from notifications.dispatch import notification_dispatch
from notifications.builders import NewKeyNotificationBuilder

# Test email
TEST_EMAIL = f"{settings.DEV_LOGIN_EMAIL_LOCALPART}+test1@{settings.DEV_LOGIN_EMAIL_DOMAIN}"
ADMIN_EMAIL = f"{settings.DEV_LOGIN_EMAIL_LOCALPART}+admin@{settings.DEV_LOGIN_EMAIL_DOMAIN}"

print("=" * 60)
print("Testing Notification Dispatch")
print("=" * 60)

# Clean up existing users if they exist
print(f"\n1. Cleaning up existing test users...")
User.objects.filter(email=TEST_EMAIL).delete()
User.objects.filter(email=ADMIN_EMAIL).delete()
print("   ✓ Cleaned up")

# Create workspace
print("\n2. Creating workspace...")
workspace, created = Workspace.objects.get_or_create(
    slug="test-notification-workspace",
    defaults={
        "name": "Test Notification Workspace",
        "mode": WorkspaceMode.VAULT.value,
    }
)
if created:
    print(f"   ✓ Created workspace: {workspace.name} ({workspace.slug})")
else:
    print(f"   ✓ Using existing workspace: {workspace.name} ({workspace.slug})")

# Create user
print(f"\n3. Creating user: {TEST_EMAIL}")
user = User.objects.create_user(
    email=TEST_EMAIL,
    password="testpass123",
    workspace=workspace,
    role=WorkspaceRole.ADMIN.value,
    first_name="Test",
    last_name="User",
)
print(f"   ✓ Created user: {user.name} ({user.email})")

# Create a UserKey (needed for NewKeyNotificationBuilder)
print("\n4. Creating UserKey...")
user_key = UserKey.objects.create(
    workspace=workspace,
    user=user,
    public_key="test-public-key-for-notification-test",
    private_key="test-private-key-for-notification-test",
    passphrase_hint="test hint words",
)
print(f"   ✓ Created UserKey: {user_key.id}")

# Create another admin user to receive the notification
print("\n5. Creating admin recipient user...")
admin_email = ADMIN_EMAIL
User.objects.filter(email=admin_email).delete()  # Clean up if exists
admin_user = User.objects.create_user(
    email=admin_email,
    password="testpass123",
    workspace=workspace,
    role=WorkspaceRole.ADMIN.value,
    first_name="Dev",
    last_name="Admin",
)
print(f"   ✓ Created admin user: {admin_user.name} ({admin_user.email})")

# Dispatch notification
print("\n6. Dispatching notification...")
import os
send_email_flag = os.getenv('SEND_EMAIL_FLAG', 'false')
use_postmark = os.getenv('USE_POSTMARK', 'false')
print(f"   - SEND_EMAIL_FLAG: {send_email_flag}")
print(f"   - USE_POSTMARK: {use_postmark}")
print(f"   - FROM_EMAIL: {os.getenv('FROM_EMAIL', 'not set')}")
print(f"   - FROM_NAME: {os.getenv('FROM_NAME', 'not set')}")

builder = NewKeyNotificationBuilder(key=user_key)
try:
    notification = notification_dispatch(
        workspace=workspace,
        recipient=admin_user,
        builder=builder
    )
    print(f"   ✓ Notification dispatched!")
    print(f"     - ID: {notification.id}")
    print(f"     - Type: {notification.type}")
    print(f"     - Event ID: {notification.event_id}")
    print(f"     - Title: {notification.text_title}")
    print(f"     - Recipient: {notification.recipient.email}")
    if send_email_flag.lower() in ('true', '1', 't'):
        if use_postmark.lower() in ('true', '1', 't'):
            print(f"     - Email sent successfully via Postmark!")
        else:
            print(f"     - Email sent successfully via SMTP (MailHog)!")
    else:
        print(f"     - Email sending disabled (SEND_EMAIL_FLAG=false)")
except Exception as e:
    print(f"   ⚠ Error sending email (notification still created): {e}")
    print(f"   Note: The notification was still saved to the database.")
    # Try to get the last notification for this recipient
    notification = admin_user.notifications.filter(
        event_id=f"new_key_{user_key.id}"
    ).first()
    if notification:
        print(f"   ✓ Found notification: {notification.id}")

# Show notification details
print("\n7. Notification details:")
print(f"   - Markdown content preview: {notification.text_markdown[:100]}...")
if notification.cta_web:
    print(f"   - Web CTAs: {len(notification.cta_web)}")
    for cta in notification.cta_web:
        print(f"     * {cta['label']}: {cta['url']}")

print("\n" + "=" * 60)
if send_email_flag.lower() in ('true', '1', 't'):
    if use_postmark.lower() in ('true', '1', 't'):
        print("✓ Test complete! Check Postmark dashboard for sent email.")
    else:
        print("✓ Test complete! Check MailHog UI at http://localhost:8025 for sent email.")
else:
    print("✓ Test complete! Email sending was disabled.")
print("=" * 60)

# Optionally clean up
cleanup = input("\nClean up test data? (y/n): ").strip().lower()
if cleanup == 'y':
    print("\nCleaning up...")
    notification.delete()
    user_key.delete()
    admin_user.delete()
    user.delete()
    print("✓ Cleaned up test data")
else:
    print("\nTest data left in database for inspection")
