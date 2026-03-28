from __future__ import annotations

import uuid

from django.http import HttpResponse
from ninja import Router

from accounts.storage import FileBackendError, FileNotFoundError, get_image_storage_service
from vaultsql.api_policies import NotFound


api_file = Router()


@api_file.get("/{file_id}")
def download_file(request, file_id: str, download: bool = False):
    try:
        parsed_id = uuid.UUID(file_id)
    except ValueError:
        raise NotFound("File not found")

    service = get_image_storage_service()

    try:
        result = service.open(parsed_id)
    except FileNotFoundError:
        raise NotFound("File not found")
    except FileBackendError as exc:
        return HttpResponse(str(exc), status=502, content_type="text/plain")

    response = HttpResponse(result.content, content_type=result.content_type)
    disposition = "attachment" if download else "inline"
    response["Content-Disposition"] = f'{disposition}; filename="{result.file_id}.webp"'
    response["Cache-Control"] = "public, max-age=31536000, immutable"
    response["ETag"] = f'"{result.sha256}"'
    return response
