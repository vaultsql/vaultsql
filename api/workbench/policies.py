"""
Policies and helper functions for workbench resources.
"""

from accounts.types import Request
from vaultsql.api_policies import NotFound, BadRequest
from connection.models import Database
from workbench.models import Folder, Worksheet


def get_database(request: Request, database_id: str) -> Database:
    """Get a database in the current workspace."""
    try:
        return Database.objects.get(
            id=database_id,
            workspace=request.auth.workspace,
        )
    except Database.DoesNotExist:
        raise NotFound("Database not found")


def get_folder(request: Request, folder_id: str, database: Database | None = None) -> Folder:
    """Get a folder owned by the current user, optionally scoped to a database."""
    try:
        filters = {
            "id": folder_id,
            "workspace": request.auth.workspace,
            "user": request.auth.user,
        }
        if database is not None:
            filters["database"] = database
        return Folder.objects.get(**filters)
    except Folder.DoesNotExist:
        raise NotFound("Folder not found")


def get_worksheet(request: Request, worksheet_id: str) -> Worksheet:
    """Get a worksheet owned by the current user."""
    try:
        return Worksheet.objects.get(
            id=worksheet_id,
            workspace=request.auth.workspace,
            user=request.auth.user,
        )
    except Worksheet.DoesNotExist:
        raise NotFound("Worksheet not found")


def check_duplicate_folder_name(
    request: Request,
    name: str,
    database: Database,
    exclude_id: str | None = None
) -> None:
    """Raise BadRequest if folder name already exists for this user on the same database."""
    qs = Folder.objects.filter(
        workspace=request.auth.workspace,
        user=request.auth.user,
        database=database,
        name=name,
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    if qs.exists():
        raise BadRequest(f"Folder with name '{name}' already exists")


def check_duplicate_worksheet_name(
    request: Request,
    name: str,
    database: Database,
    folder: Folder | None,
    exclude_id: str | None = None
) -> None:
    """Raise BadRequest if worksheet name already exists in the same database/folder."""
    qs = Worksheet.objects.filter(
        workspace=request.auth.workspace,
        user=request.auth.user,
        database=database,
        folder=folder,
        name=name,
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    if qs.exists():
        folder_desc = f"folder '{folder.name}'" if folder else "root"
        raise BadRequest(f"Worksheet with name '{name}' already exists in {folder_desc}")
