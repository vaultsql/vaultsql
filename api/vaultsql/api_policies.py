"""
Reusable API policies and exceptions for Django Ninja endpoints.

These are generic utilities that can be used across any app, not specific to
connection management.
"""

from ninja.errors import HttpError

from accounts.models import WorkspaceRole, WorkspaceMode, Workspace
from accounts.types import Request


# ============ Exceptions ============

class NotFound(HttpError):
    """Raise 404 Not Found."""
    def __init__(self, message: str = "Not found"):
        super().__init__(404, message)


class Forbidden(HttpError):
    """Raise 403 Forbidden."""
    def __init__(self, message: str = "Forbidden"):
        super().__init__(403, message)


class BadRequest(HttpError):
    """Raise 400 Bad Request."""
    def __init__(self, message: str = "Bad request"):
        super().__init__(400, message)


class Unauthorized(HttpError):
    """Raise 401 Unauthorized."""
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(401, message)


# ============ Policy Checks ============

def require_admin(request: Request) -> None:
    """Raise Forbidden if user is not an admin."""
    if request.auth.role != WorkspaceRole.ADMIN.value:
        raise Forbidden("Admin access required")


def require_vault_mode(workspace: Workspace, message: str = "This operation requires vault mode") -> None:
    """Raise BadRequest if workspace is not in vault mode."""
    if workspace.mode != WorkspaceMode.VAULT.value:
        raise BadRequest(message)


def require_passphrase_for_vault(workspace: Workspace, passphrase: str | None) -> str | None:
    """
    Return passphrase if vault mode, None otherwise.
    Raises BadRequest if vault mode but no passphrase provided.
    """
    if workspace.mode == WorkspaceMode.VAULT.value:
        if not passphrase:
            raise BadRequest("Passphrase required for vault mode")
        return passphrase
    return None
