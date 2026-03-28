from typing import Optional
from ninja import Schema


# ============ Folder Schemas ============

class FolderCreateRequest(Schema):
    database_id: str  # Required in API
    name: str
    position: Optional[int] = None


class FolderUpdateRequest(Schema):
    name: Optional[str] = None
    position: Optional[int] = None


class FolderResponse(Schema):
    id: str
    database_id: str
    name: str
    position: int
    created_at: str
    updated_at: str


# ============ Worksheet Schemas ============

class WorksheetCreateRequest(Schema):
    database_id: str  # Required in API
    name: str
    content: str = ""
    folder_id: Optional[str] = None
    position: Optional[int] = None


class WorksheetUpdateRequest(Schema):
    name: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None  # null = move to root
    position: Optional[int] = None


class WorksheetResponse(Schema):
    id: str
    database_id: str
    name: str
    content: str
    folder_id: Optional[str]
    position: int
    created_at: str
    updated_at: str


# ============ Common Schemas ============

class SuccessResponse(Schema):
    success: bool
