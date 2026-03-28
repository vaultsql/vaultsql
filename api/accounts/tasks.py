from celery import shared_task
from django.utils import timezone
from datetime import timedelta


@shared_task
def cleanup_expired_login_codes():
    """Delete login codes older than 24 hours."""
    from .models import LoginCode

    cutoff = timezone.now() - timedelta(hours=24)
    deleted_count, _ = LoginCode.objects.filter(
        created_at__lt=cutoff
    ).delete()
    return f"Deleted {deleted_count} expired login codes"
