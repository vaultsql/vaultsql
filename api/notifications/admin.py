from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'type', 'recipient', 'workspace', 'created_at', 'dispatched_at']
    list_filter = ['type', 'workspace', 'created_at']
    search_fields = ['event_id', 'recipient__email', 'text_title', 'text_short']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['recipient', 'workspace']

