"""API endpoints for audit log management."""
import csv
import io
import json
from datetime import datetime, timezone
from django.core.paginator import Paginator

from django.http import HttpResponse
from ninja import Router

from accounts.types import Request
from vaultsql.api_policies import require_admin
from workspace.models import AuditLog
from workspace.types import AuditLogEntrySchema, AuditLogListResponse


api_audit = Router()


@api_audit.get("/audit-log/download")
def download_audit_log(
    request: Request,
    start_date: str | None = None,
    end_date: str | None = None,
):
    """
    Download audit log as CSV. Admin only.
    
    Query params:
        start_date: ISO date string (YYYY-MM-DD), inclusive
        end_date: ISO date string (YYYY-MM-DD), inclusive
    """
    require_admin(request)
    
    qs = AuditLog.objects.filter(workspace=request.auth.workspace)
    
    if start_date:
        try:
            start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
            qs = qs.filter(created_at__gte=start)
        except ValueError:
            pass
    
    if end_date:
        try:
            end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
            # Include the entire end day
            end = end.replace(hour=23, minute=59, second=59)
            qs = qs.filter(created_at__lte=end)
        except ValueError:
            pass
    
    qs = qs.order_by("created_at")
    
    # Build CSV response
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header row
    writer.writerow([
        "timestamp",
        "actor_type",
        "actor_email",
        "event_type",
        "database_name",
        "query_actor_type",
        "query_hash",
        "query_text",
        "database",
        "metadata",
    ])
    
    # Data rows
    for log in qs.iterator():
        writer.writerow([
            log.created_at.isoformat(),
            log.actor_type,
            log.actor_email or "",
            log.event_type,
            log.database_name or "",
            log.query_actor_type or "",
            log.query_hash or "",
            log.query_text or "",
            log.database or "",
            json.dumps(log.metadata) if log.metadata else "",
        ])
    
    # Create response
    response = HttpResponse(output.getvalue(), content_type="text/csv")
    
    # Generate filename with date range
    filename = "audit_log"
    if start_date:
        filename += f"_from_{start_date}"
    if end_date:
        filename += f"_to_{end_date}"
    filename += ".csv"
    
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_audit.get("/audit-log", response=AuditLogListResponse)
def list_audit_log(
    request: Request,
    categories: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    """
    List audit log entries with pagination. Admin only.
    
    Query params:
        categories: Comma-separated list of categories to include:
            - "application" - Application events (user.joined, account.access.*)
            - "system_queries" - System queries (query.execute with query_actor_type=application)
            - "data_browser_queries" - Data browser queries (query.execute with query_actor_type=user)
            - "custom_queries" - Custom queries (query.execute with query_actor_type=custom)
        page: Page number (1-indexed)
        page_size: Number of items per page (default 50, max 200)
    """
    require_admin(request)
    
    # Limit page size
    page_size = min(page_size, 200)
    page_size = max(page_size, 1)
    page = max(page, 1)
    
    qs = AuditLog.objects.filter(workspace=request.auth.workspace)
    
    # Parse categories filter
    if categories:
        category_list = [c.strip() for c in categories.split(",")]
        
        # Build Q objects for filtering
        from django.db.models import Q
        
        filters = Q()
        
        if "application" in category_list:
            # Application events: event_type NOT starting with "query."
            filters |= ~Q(event_type__startswith="query.")
        
        if "system_queries" in category_list:
            # System queries: query.execute with query_actor_type=application
            filters |= Q(event_type="query.execute", query_actor_type="application")
        
        if "data_browser_queries" in category_list:
            # Data browser queries: query.execute with query_actor_type=user
            filters |= Q(event_type="query.execute", query_actor_type="user")
        
        if "custom_queries" in category_list:
            # Custom queries: query.execute with query_actor_type=custom
            filters |= Q(event_type="query.execute", query_actor_type="custom")
        
        if filters:
            qs = qs.filter(filters)
    
    # Order by created_at descending (newest first)
    qs = qs.order_by("-created_at")
    
    # Paginate
    paginator = Paginator(qs, page_size)
    page_obj = paginator.get_page(page)
    
    # Convert to response format
    items = [
        AuditLogEntrySchema(
            id=str(log.id),
            created_at=log.created_at.isoformat(),
            actor_type=log.actor_type,
            actor_email=log.actor_email,
            event_type=log.event_type,
            database_name=log.database_name,
            query_actor_type=log.query_actor_type,
            database=log.database,
            metadata=log.metadata or {},
        )
        for log in page_obj
    ]
    
    return AuditLogListResponse(
        items=items,
        total=paginator.count,
        page=page,
        page_size=page_size,
    )
