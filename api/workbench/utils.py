"""
Utility functions for workbench features.
"""

from datetime import timedelta
from django.utils import timezone
from workbench.models import Worksheet, WorksheetVersion


def create_worksheet_version(worksheet: Worksheet) -> WorksheetVersion:
    """
    Create a new version snapshot for a worksheet.
    Returns the created version.
    """
    # Get the next version number
    last_version = WorksheetVersion.objects.filter(
        worksheet=worksheet
    ).order_by("-version_number").first()
    
    next_version = (last_version.version_number + 1) if last_version else 1
    
    version = WorksheetVersion.objects.create(
        worksheet=worksheet,
        content=worksheet.content,
        version_number=next_version,
    )
    
    # Cull old versions after creating new one
    cull_worksheet_versions(worksheet)
    
    return version


def cull_worksheet_versions(worksheet: Worksheet, max_versions: int = 10) -> int:
    """
    Apply logarithmic culling to worksheet versions.
    
    Strategy:
    - Always keep the latest 3 versions
    - Keep 1 version from the last hour
    - Keep 1 version from the last day
    - Keep 1 version from the last week
    - Keep the oldest version
    
    This gives us ~7-10 versions with diminishing granularity for older history.
    
    Returns the number of versions deleted.
    """
    versions = list(WorksheetVersion.objects.filter(
        worksheet=worksheet
    ).order_by("-version_number"))
    
    if len(versions) <= max_versions:
        return 0
    
    now = timezone.now()
    
    # IDs of versions to keep
    keep_ids = set()
    
    # Always keep the latest 3 versions
    for v in versions[:3]:
        keep_ids.add(v.id)
    
    # Time buckets to preserve
    buckets = [
        ("last_hour", now - timedelta(hours=1)),
        ("last_day", now - timedelta(days=1)),
        ("last_week", now - timedelta(weeks=1)),
    ]
    
    # For each bucket, keep the most recent version that falls within it
    for bucket_name, bucket_start in buckets:
        for v in versions:
            if v.created_at >= bucket_start and v.id not in keep_ids:
                keep_ids.add(v.id)
                break
    
    # Always keep the oldest version (last in list)
    if versions:
        keep_ids.add(versions[-1].id)
    
    # Delete versions not in keep set, but never go below max_versions
    delete_ids = [v.id for v in versions if v.id not in keep_ids]
    
    # Only delete if we'd still have more than enough versions
    if len(versions) - len(delete_ids) < max_versions // 2:
        # Keep more recent versions if we're deleting too many
        delete_ids = delete_ids[:(len(versions) - max_versions)]
    
    if delete_ids:
        deleted_count, _ = WorksheetVersion.objects.filter(id__in=delete_ids).delete()
        return deleted_count
    
    return 0
