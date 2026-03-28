"""API endpoints for workspace settings."""
import logging
from ninja import Router
from free_email_domains import whitelist as free_email_domains

from accounts.types import Request
from vaultsql.api_policies import require_admin
from workspace.models import WorkspaceSettings
from workspace.types import WorkspaceSettingsResponse, WorkspaceSettingsUpdateRequest

logger = logging.getLogger(__name__)


api_settings = Router()


def _get_or_create_settings(workspace) -> WorkspaceSettings:
    """Get or create workspace settings."""
    settings, _ = WorkspaceSettings.objects.get_or_create(workspace=workspace)
    return settings


def _settings_response(settings: WorkspaceSettings, admin_email: str | None = None) -> WorkspaceSettingsResponse:
    admin_domain = None
    is_free_email_domain = False
    if admin_email:
        admin_domain = admin_email.split("@")[-1].lower()
        is_free_email_domain = admin_domain in free_email_domains
    return WorkspaceSettingsResponse(
        audit_enabled=settings.audit_enabled,
        audit_store_queries=settings.audit_store_queries,
        allowed_email_domains=settings.allowed_email_domains or [],
        workspace_name=settings.workspace.name,
        admin_email_domain=admin_domain,
        is_free_email_domain=is_free_email_domain,
    )


@api_settings.get("/", response=WorkspaceSettingsResponse)
def get_settings(request: Request):
    """Get workspace settings. Admin only."""
    require_admin(request)
    settings = _get_or_create_settings(request.auth.workspace)
    return _settings_response(settings, admin_email=request.auth.user.email)


@api_settings.patch("/", response=WorkspaceSettingsResponse)
def update_settings(request: Request, data: WorkspaceSettingsUpdateRequest):
    """Update workspace settings. Admin only."""
    require_admin(request)
    settings = _get_or_create_settings(request.auth.workspace)
    workspace = request.auth.workspace
    from vaultsql.api_policies import BadRequest

    if data.audit_enabled is not None:
        settings.audit_enabled = data.audit_enabled
    if data.audit_store_queries is not None:
        settings.audit_store_queries = data.audit_store_queries
    
    if data.workspace_name is not None:
        workspace.name = data.workspace_name.strip()
        workspace.save(update_fields=["name"])
    
    if data.allowed_email_domains is not None:
        # Security: Only allow admin's own email domain to prevent domain hijacking
        admin_email = request.auth.user.email
        admin_domain = admin_email.split("@")[-1].lower()
        
        validated_domains = []
        for domain in data.allowed_email_domains:
            domain = domain.strip().lower()
            if not domain:
                continue
            # Only allow admin's own domain
            if domain != admin_domain:
                raise BadRequest(f"Only your own email domain ({admin_domain}) can be allowed. Contact support to add other domains.")
            
            # Check if domain is a free email provider
            if domain in free_email_domains:
                raise BadRequest(f"Free email domains like {domain} cannot be allowed. Please use your organization's domain.")
            
            validated_domains.append(domain)
        
        # Log warning if allowing domain access (potential security issue)
        if validated_domains and validated_domains != settings.allowed_email_domains:
            logger.warning(
                f"SECURITY: Workspace {workspace.slug} (ID: {workspace.id}) enabled domain-based access for domain(s): {', '.join(validated_domains)}. "
                f"Admin: {admin_email} (User ID: {request.auth.user.id})"
            )
        
        settings.allowed_email_domains = validated_domains

    settings.save()
    return _settings_response(settings, admin_email=request.auth.user.email)
