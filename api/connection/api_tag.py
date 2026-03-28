"""
API endpoints for database tag management.

Tags are workspace-scoped labels for categorizing databases (teams, apps, compliance, etc.).
"""

from ninja import Router

from accounts.types import Request
from vaultsql.api_policies import BadRequest, NotFound, require_admin
from connection.models import DatabaseTag
from connection.types import (
    TagCreateRequest,
    TagUpdateRequest,
    TagResponse,
    SuccessResponse,
)


api_tag = Router()


def _tag_response(tag: DatabaseTag) -> TagResponse:
    """Build TagResponse from model."""
    return TagResponse(
        id=str(tag.id),
        name=tag.name,
        color=tag.color,
        created_at=tag.created_at.isoformat(),
        updated_at=tag.updated_at.isoformat(),
    )


# ============ Tag CRUD ============

@api_tag.get("/", response=list[TagResponse])
def list_tags(request: Request):
    """List all tags in the current workspace."""
    tags = DatabaseTag.objects.filter(workspace=request.auth.workspace).order_by("name")
    return [_tag_response(tag) for tag in tags]


@api_tag.post("/", response=TagResponse)
def create_tag(request: Request, data: TagCreateRequest):
    """Create a new tag. Admin only."""
    require_admin(request)
    
    # Check for duplicate tag name
    if DatabaseTag.objects.filter(workspace=request.auth.workspace, name=data.name).exists():
        raise BadRequest(f"Tag with name '{data.name}' already exists in this workspace")
    
    tag = DatabaseTag.objects.create(
        workspace=request.auth.workspace,
        name=data.name,
        color=data.color,
    )
    
    return _tag_response(tag)


@api_tag.get("/{tag_id}", response=TagResponse)
def get_tag(request: Request, tag_id: str):
    """Get a specific tag."""
    try:
        tag = DatabaseTag.objects.get(id=tag_id, workspace=request.auth.workspace)
    except DatabaseTag.DoesNotExist:
        raise NotFound("Tag not found")
    
    return _tag_response(tag)


@api_tag.patch("/{tag_id}", response=TagResponse)
def update_tag(request: Request, tag_id: str, data: TagUpdateRequest):
    """Update a tag. Admin only."""
    require_admin(request)
    
    try:
        tag = DatabaseTag.objects.get(id=tag_id, workspace=request.auth.workspace)
    except DatabaseTag.DoesNotExist:
        raise NotFound("Tag not found")
    
    if data.name and data.name != tag.name:
        # Check for duplicate tag name
        if DatabaseTag.objects.filter(workspace=request.auth.workspace, name=data.name).exists():
            raise BadRequest(f"Tag with name '{data.name}' already exists in this workspace")
        tag.name = data.name
    
    if data.color is not None:
        tag.color = data.color
    
    tag.save()
    return _tag_response(tag)


@api_tag.delete("/{tag_id}", response=SuccessResponse)
def delete_tag(request: Request, tag_id: str):
    """Delete a tag. Admin only. Cannot delete tags that are in use."""
    require_admin(request)
    
    try:
        tag = DatabaseTag.objects.get(id=tag_id, workspace=request.auth.workspace)
    except DatabaseTag.DoesNotExist:
        raise NotFound("Tag not found")
    
    # Check if tag is in use by any databases
    if tag.databases.exists():
        database_count = tag.databases.count()
        raise BadRequest(
            f"Cannot delete tag '{tag.name}' because it is used by {database_count} database(s). "
            f"Remove the tag from all databases first."
        )
    
    tag.delete()
    return SuccessResponse(success=True)
