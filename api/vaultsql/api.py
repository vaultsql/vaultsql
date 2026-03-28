from django.utils import timezone
from ninja import NinjaAPI
from ninja.security import HttpBearer

from accounts.api_auth import api_auth
from accounts.api_group import api_group
from accounts.api_user import api_user
from accounts.api_identity import api_identity
from accounts.api_workspace import api_workspace
from accounts.api_file import api_file
from accounts.models import Session
from connection.api_account import api_account
from connection.api_key import api_key
from connection.api_database import api_database
from connection.api_access import api_access
from connection.api_tag import api_tag
from notifications.api_notification import api_notification
from workbench.api_worksheet import api_workbench
from workspace.api_audit import api_audit
from workspace.api_settings import api_settings


class InvalidToken(Exception):
    pass


class AuthError(Exception):
    def __init__(self, message=None):
        self.message = message or "Default authentication error message."


class AuthIdentity(HttpBearer):
    def authenticate(self, request, token):
        try:
            if session := Session.objects.select_related('identity', 'user', 'workspace').get(
                token=token,
                expiry__gt=timezone.now(),
                identity__isnull=False,
            ):
                return session
        except Session.DoesNotExist:
            raise InvalidToken


class AuthWorkspace(HttpBearer):
    def authenticate(self, request, token):
        try:
            if session := Session.objects.select_related('identity', 'user', 'workspace').get(
                token=token,
                expiry__gt=timezone.now(),
                user__isnull=False,
                workspace__isnull=False,
                user__is_active=True,
                user__deactivated_at__isnull=True,
                workspace__is_active=True,
            ):
                return session
        except Session.DoesNotExist:
            raise InvalidToken


api = NinjaAPI()


@api.exception_handler(InvalidToken)
def on_invalid_token(request, exc):
    return api.create_response(
        request, {"detail": "Invalid token supplied"}, status=401
    )


@api.exception_handler(AuthError)
def on_auth_error(request, exc):
    return api.create_response(
        request,
        {"message": exc.message},
        status=401,
    )


api.add_router("/auth", api_auth)
api.add_router("/identity", api_identity, auth=AuthIdentity())
api.add_router("/user", api_user, auth=AuthWorkspace())
api.add_router("/group", api_group, auth=AuthWorkspace())
api.add_router("/workspace", api_workspace, auth=AuthWorkspace())
api.add_router("/file", api_file)
api.add_router("/account", api_account, auth=AuthWorkspace())
api.add_router("/keys", api_key, auth=AuthWorkspace())
api.add_router("/database", api_database, auth=AuthWorkspace())
api.add_router("/access", api_access, auth=AuthWorkspace())
api.add_router("/tag", api_tag, auth=AuthWorkspace())
api.add_router("/notification", api_notification, auth=AuthWorkspace())
api.add_router("/workbench", api_workbench, auth=AuthWorkspace())
api.add_router("/audit", api_audit, auth=AuthWorkspace())
api.add_router("/settings", api_settings, auth=AuthWorkspace())


@api.get("/health")
def health(request):
    from django.db import connection
    from accounts.models import User
    
    try:
        # Verify database connectivity by counting users
        # This ensures the database connection is working
        user_count = User.objects.count()
        
        # Ensure count is valid (should be >= 0)
        if user_count < 0:
            return api.create_response(
                request,
                {"status": "unhealthy", "error": "Invalid user count"},
                status=503
            )
        
        return {
            "status": "ok",
            "database": "connected",
            "user_count": user_count
        }
    except Exception as e:
        # Database connection failed or query failed
        return api.create_response(
            request,
            {"status": "unhealthy", "error": str(e)},
            status=503
        )
