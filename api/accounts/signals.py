"""Signals for accounts app."""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, Session


@receiver(post_save, sender=User)
def sync_user_role_to_sessions(sender, instance, **kwargs):
    """Sync User.role changes to all active Session.role.

    When a user's role changes, update all their active sessions
    to reflect the new role. This ensures permission checks
    remain accurate without requiring re-authentication.

    Args:
        sender: The User model class
        instance: The User instance being saved
        **kwargs: Additional signal kwargs
    """
    # Only update if role might have changed (check update_fields if provided)
    update_fields = kwargs.get('update_fields')
    if update_fields is not None and 'role' not in update_fields:
        return

    # Update all active sessions for this user
    Session.objects.filter(user=instance).update(role=instance.role)


@receiver(post_save, sender=User)
def revoke_sessions_for_deactivated_user(sender, instance, **kwargs):
    """Revoke sessions when a user is deactivated."""
    update_fields = kwargs.get("update_fields")
    if update_fields is not None and not {"is_active", "deactivated_at"} & set(update_fields):
        return

    if not instance.is_active or instance.deactivated_at is not None:
        Session.objects.filter(user=instance).delete()
