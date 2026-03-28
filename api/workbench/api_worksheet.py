"""
API endpoints for worksheet and folder management.

All resources are private to the authenticated user.
"""

from django.db import models
from ninja import Router

from accounts.types import Request
from vaultsql.api_policies import BadRequest
from workbench.models import Folder, Worksheet
from workbench.policies import (
    get_database,
    get_folder,
    get_worksheet,
    check_duplicate_folder_name,
    check_duplicate_worksheet_name,
)
from workbench.types import (
    FolderCreateRequest,
    FolderUpdateRequest,
    FolderResponse,
    WorksheetCreateRequest,
    WorksheetUpdateRequest,
    WorksheetResponse,
    SuccessResponse,
)
from workbench.utils import create_worksheet_version


api_workbench = Router()


# ============ Response Builders ============

def _folder_response(folder: Folder) -> FolderResponse:
    """Build FolderResponse from model."""
    return FolderResponse(
        id=str(folder.id),
        database_id=str(folder.database_id) if folder.database_id else "",
        name=folder.name,
        position=folder.position,
        created_at=folder.created_at.isoformat(),
        updated_at=folder.updated_at.isoformat(),
    )


def _worksheet_response(worksheet: Worksheet) -> WorksheetResponse:
    """Build WorksheetResponse from model."""
    return WorksheetResponse(
        id=str(worksheet.id),
        database_id=str(worksheet.database_id) if worksheet.database_id else "",
        name=worksheet.name,
        content=worksheet.content,
        folder_id=str(worksheet.folder_id) if worksheet.folder_id else None,
        position=worksheet.position,
        created_at=worksheet.created_at.isoformat(),
        updated_at=worksheet.updated_at.isoformat(),
    )


# ============ Folder Endpoints ============

@api_workbench.get("/folders", response=list[FolderResponse])
def list_folders(request: Request, database_id: str):
    """List all folders for the current user on a specific database."""
    database = get_database(request, database_id)
    
    folders = Folder.objects.filter(
        workspace=request.auth.workspace,
        user=request.auth.user,
        database=database,
    ).order_by("position", "name")
    
    return [_folder_response(f) for f in folders]


@api_workbench.post("/folders", response=FolderResponse)
def create_folder(request: Request, data: FolderCreateRequest):
    """Create a new folder associated with a database."""
    database = get_database(request, data.database_id)

    check_duplicate_folder_name(request, data.name, database)
    
    # Get next position if not specified
    position = data.position
    if position is None:
        max_pos = Folder.objects.filter(
            workspace=request.auth.workspace,
            user=request.auth.user,
            database=database,
        ).aggregate(max_pos=models.Max("position"))["max_pos"]
        position = (max_pos or 0) + 1
    
    folder = Folder.objects.create(
        workspace=request.auth.workspace,
        user=request.auth.user,
        database=database,
        name=data.name,
        position=position,
    )
    
    return _folder_response(folder)


@api_workbench.patch("/folders/{folder_id}", response=FolderResponse)
def update_folder(request: Request, folder_id: str, data: FolderUpdateRequest):
    """Update a folder."""
    folder = get_folder(request, folder_id)
    
    if data.name is not None and data.name != folder.name:
        check_duplicate_folder_name(request, data.name, folder.database, exclude_id=folder_id)
        folder.name = data.name
    
    if data.position is not None:
        folder.position = data.position
    
    folder.save()
    return _folder_response(folder)


@api_workbench.delete("/folders/{folder_id}", response=SuccessResponse)
def delete_folder(request: Request, folder_id: str):
    """
    Delete a folder.
    Worksheets in this folder are moved to root (folder=None).
    """
    folder = get_folder(request, folder_id)
    
    # Move worksheets to root before deleting
    Worksheet.objects.filter(folder=folder).update(folder=None)
    
    folder.delete()
    return SuccessResponse(success=True)


# ============ Worksheet Endpoints ============

@api_workbench.get("/worksheets", response=list[WorksheetResponse])
def list_worksheets(request: Request, database_id: str, folder_id: str | None = None):
    """
    List worksheets for the current user on a specific database.
    Optionally filter by folder_id. If folder_id is "root", returns only root-level worksheets.
    """
    database = get_database(request, database_id)
    
    qs = Worksheet.objects.filter(
        workspace=request.auth.workspace,
        user=request.auth.user,
        database=database,
    )
    
    if folder_id is not None:
        if folder_id == "root":
            qs = qs.filter(folder__isnull=True)
        else:
            # Verify folder exists and belongs to user
            folder = get_folder(request, folder_id)
            qs = qs.filter(folder=folder)
    
    worksheets = qs.order_by("folder", "position", "name")
    return [_worksheet_response(w) for w in worksheets]


@api_workbench.post("/worksheets", response=WorksheetResponse)
def create_worksheet(request: Request, data: WorksheetCreateRequest):
    """Create a new worksheet associated with a database."""
    database = get_database(request, data.database_id)
    
    folder = None
    if data.folder_id:
        folder = get_folder(request, data.folder_id)
    
    check_duplicate_worksheet_name(request, data.name, database, folder)
    
    # Get next position if not specified
    position = data.position
    if position is None:
        max_pos = Worksheet.objects.filter(
            workspace=request.auth.workspace,
            user=request.auth.user,
            database=database,
            folder=folder,
        ).aggregate(max_pos=models.Max("position"))["max_pos"]
        position = (max_pos or 0) + 1
    
    worksheet = Worksheet.objects.create(
        workspace=request.auth.workspace,
        user=request.auth.user,
        database=database,
        folder=folder,
        name=data.name,
        content=data.content,
        position=position,
    )
    
    # Create initial version
    create_worksheet_version(worksheet)
    
    return _worksheet_response(worksheet)


@api_workbench.get("/worksheets/{worksheet_id}", response=WorksheetResponse)
def get_worksheet_endpoint(request: Request, worksheet_id: str):
    """Get a specific worksheet."""
    worksheet = get_worksheet(request, worksheet_id)
    return _worksheet_response(worksheet)


@api_workbench.patch("/worksheets/{worksheet_id}", response=WorksheetResponse)
def update_worksheet(request: Request, worksheet_id: str, data: WorksheetUpdateRequest):
    """Update a worksheet."""
    worksheet = get_worksheet(request, worksheet_id)
    
    # Track if content changed for versioning
    content_changed = False
    
    # Handle folder change
    new_folder = worksheet.folder
    folder_changed = False
    if data.folder_id is not None:
        if data.folder_id == "":
            # Move to root
            new_folder = None
            folder_changed = worksheet.folder is not None
        else:
            new_folder = get_folder(request, data.folder_id)
            folder_changed = worksheet.folder_id != new_folder.id
    
    # Check name uniqueness if name or folder changed (database stays the same)
    if data.name is not None and data.name != worksheet.name:
        check_duplicate_worksheet_name(request, data.name, worksheet.database, new_folder, exclude_id=worksheet_id)
        worksheet.name = data.name
    elif folder_changed:
        # Name unchanged but folder changed - check uniqueness in new folder
        check_duplicate_worksheet_name(request, worksheet.name, worksheet.database, new_folder, exclude_id=worksheet_id)
    
    if folder_changed:
        worksheet.folder = new_folder
    
    if data.content is not None and data.content != worksheet.content:
        worksheet.content = data.content
        content_changed = True
    
    if data.position is not None:
        worksheet.position = data.position
    
    worksheet.save()
    
    # Create version if content changed
    if content_changed:
        create_worksheet_version(worksheet)
    
    return _worksheet_response(worksheet)


@api_workbench.delete("/worksheets/{worksheet_id}", response=SuccessResponse)
def delete_worksheet(request: Request, worksheet_id: str):
    """Delete a worksheet and all its versions."""
    worksheet = get_worksheet(request, worksheet_id)
    worksheet.delete()  # Cascade deletes versions
    return SuccessResponse(success=True)
