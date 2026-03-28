"""Image storage utilities with DB fallback and optional S3-compatible backend."""

from __future__ import annotations

import hashlib
import io
import logging
import uuid
from dataclasses import dataclass
from typing import BinaryIO, Protocol

import boto3
import httpx
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings
from PIL import ExifTags, Image

from accounts.models import ImageBlob

logger = logging.getLogger(__name__)

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_INTERNAL_FILE_PREFIX = "/api/file/"


class FileNotFoundError(Exception):
    """Raised when a stored file cannot be found."""


class FileBackendError(Exception):
    """Raised when a storage backend errors for reasons other than missing file."""


@dataclass(frozen=True)
class ImageMetadata:
    width: int
    height: int


@dataclass(frozen=True)
class StoredImageRef:
    file_id: uuid.UUID


@dataclass(frozen=True)
class FileStreamResult:
    file_id: uuid.UUID
    content: bytes
    content_type: str
    byte_size: int
    sha256: str


class ImageStorageProvider(Protocol):
    def save(self, file_bytes: bytes, content_type: str, metadata: ImageMetadata) -> StoredImageRef:
        ...

    def open(self, file_id: uuid.UUID) -> FileStreamResult:
        ...

    def delete(self, file_id: uuid.UUID) -> None:
        ...


class DbImageStorageProvider:
    """Persists image bytes directly in the application database."""

    def save(self, file_bytes: bytes, content_type: str, metadata: ImageMetadata) -> StoredImageRef:
        digest = hashlib.sha256(file_bytes).hexdigest()
        blob = ImageBlob.objects.create(
            storage_backend=ImageBlob.StorageBackend.DB.value,
            content_type=content_type,
            byte_size=len(file_bytes),
            width=metadata.width,
            height=metadata.height,
            sha256=digest,
            blob_data=file_bytes,
        )
        return StoredImageRef(file_id=blob.id)

    def open(self, file_id: uuid.UUID) -> FileStreamResult:
        blob = ImageBlob.objects.filter(id=file_id).first()
        if not blob:
            raise FileNotFoundError("File not found")
        if blob.storage_backend != ImageBlob.StorageBackend.DB.value:
            raise FileBackendError("File is not stored in db backend")
        if blob.blob_data is None:
            raise FileNotFoundError("File bytes missing")
        return FileStreamResult(
            file_id=blob.id,
            content=bytes(blob.blob_data),
            content_type=blob.content_type,
            byte_size=blob.byte_size,
            sha256=blob.sha256,
        )

    def delete(self, file_id: uuid.UUID) -> None:
        ImageBlob.objects.filter(id=file_id).delete()


class S3ImageStorageProvider:
    """Stores file bytes in S3-compatible object storage and metadata in DB."""

    def _client(self):
        return boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY,
            aws_secret_access_key=settings.R2_SECRET,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    def save(self, file_bytes: bytes, content_type: str, metadata: ImageMetadata) -> StoredImageRef:
        blob_id = uuid.uuid4()
        object_key = f"images/{blob_id}.webp"

        self._client().put_object(
            Bucket=settings.R2_BUCKET,
            Key=object_key,
            Body=file_bytes,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )

        digest = hashlib.sha256(file_bytes).hexdigest()
        ImageBlob.objects.create(
            id=blob_id,
            storage_backend=ImageBlob.StorageBackend.S3.value,
            content_type=content_type,
            byte_size=len(file_bytes),
            width=metadata.width,
            height=metadata.height,
            sha256=digest,
            object_key=object_key,
        )
        return StoredImageRef(file_id=blob_id)

    def open(self, file_id: uuid.UUID) -> FileStreamResult:
        blob = ImageBlob.objects.filter(id=file_id).first()
        if not blob:
            raise FileNotFoundError("File not found")
        if blob.storage_backend != ImageBlob.StorageBackend.S3.value:
            raise FileBackendError("File is not stored in s3 backend")
        if not blob.object_key:
            raise FileNotFoundError("Object key missing")

        try:
            response = self._client().get_object(Bucket=settings.R2_BUCKET, Key=blob.object_key)
            content = response["Body"].read()
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in {"NoSuchKey", "404", "NotFound"}:
                raise FileNotFoundError("Object not found") from exc
            raise FileBackendError("Failed to fetch object") from exc

        return FileStreamResult(
            file_id=blob.id,
            content=content,
            content_type=blob.content_type,
            byte_size=blob.byte_size,
            sha256=blob.sha256,
        )

    def delete(self, file_id: uuid.UUID) -> None:
        blob = ImageBlob.objects.filter(id=file_id).first()
        if not blob:
            return

        if blob.storage_backend == ImageBlob.StorageBackend.S3.value and blob.object_key:
            try:
                self._client().delete_object(Bucket=settings.R2_BUCKET, Key=blob.object_key)
            except ClientError:
                logger.warning("Failed deleting object %s", blob.object_key, exc_info=True)

        blob.delete()


class HybridImageStorageService:
    """Storage service that prefers S3 when enabled, with DB fallback."""

    def __init__(self):
        self.db_provider = DbImageStorageProvider()
        self.s3_provider = S3ImageStorageProvider()

    def _s3_enabled(self) -> bool:
        return bool(getattr(settings, "ENABLE_S3", False) or getattr(settings, "ENABLE_R2", False))

    def save(self, file_bytes: bytes, content_type: str, metadata: ImageMetadata) -> StoredImageRef:
        if self._s3_enabled():
            try:
                return self.s3_provider.save(file_bytes, content_type, metadata)
            except Exception:
                logger.warning("S3 save failed, falling back to DB storage", exc_info=True)
        return self.db_provider.save(file_bytes, content_type, metadata)

    def open(self, file_id: uuid.UUID) -> FileStreamResult:
        blob = ImageBlob.objects.filter(id=file_id).first()
        if not blob:
            raise FileNotFoundError("File not found")

        if blob.storage_backend == ImageBlob.StorageBackend.DB.value:
            return self.db_provider.open(file_id)
        if blob.storage_backend == ImageBlob.StorageBackend.S3.value:
            return self.s3_provider.open(file_id)
        raise FileBackendError(f"Unsupported storage backend: {blob.storage_backend}")

    def delete(self, file_id: uuid.UUID) -> None:
        blob = ImageBlob.objects.filter(id=file_id).first()
        if not blob:
            return

        if blob.storage_backend == ImageBlob.StorageBackend.S3.value:
            self.s3_provider.delete(file_id)
            return

        self.db_provider.delete(file_id)


def get_image_storage_service() -> HybridImageStorageService:
    return HybridImageStorageService()


def build_internal_file_url(file_id: uuid.UUID) -> str:
    return f"{_INTERNAL_FILE_PREFIX}{file_id}"


def parse_internal_file_id(image_url: str | None) -> uuid.UUID | None:
    if not image_url or not image_url.startswith(_INTERNAL_FILE_PREFIX):
        return None

    raw_id = image_url.removeprefix(_INTERNAL_FILE_PREFIX).strip()
    if not raw_id:
        return None

    try:
        return uuid.UUID(raw_id)
    except ValueError:
        return None


def cleanup_internal_image_url(image_url: str | None) -> None:
    file_id = parse_internal_file_id(image_url)
    if not file_id:
        return

    try:
        get_image_storage_service().delete(file_id)
    except Exception:
        logger.warning("Failed cleaning up old image %s", image_url, exc_info=True)


def process_profile_image(file: BinaryIO) -> tuple[bytes, str, ImageMetadata]:
    """Process image: orient, normalize color, max-bound resize, WebP encode."""
    try:
        img = Image.open(file)

        # Handle EXIF orientation when available.
        try:
            orientation_tag = next(
                (tag for tag, name in ExifTags.TAGS.items() if name == "Orientation"),
                None,
            )
            if orientation_tag is not None:
                exif = img._getexif()
                if exif is not None:
                    orient = exif.get(orientation_tag)
                    if orient == 3:
                        img = img.rotate(180, expand=True)
                    elif orient == 6:
                        img = img.rotate(270, expand=True)
                    elif orient == 8:
                        img = img.rotate(90, expand=True)
        except Exception:
            pass

        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        max_dimension = int(getattr(settings, "IMAGE_MAX_DIMENSION", 512) or 512)
        quality = int(getattr(settings, "IMAGE_WEBP_QUALITY", 85) or 85)

        width, height = img.size
        longest = max(width, height)
        if longest > max_dimension:
            scale = max_dimension / longest
            new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        output = io.BytesIO()
        img.save(output, format="WebP", quality=quality, optimize=True)
        output.seek(0)

        processed_width, processed_height = img.size
        return output.read(), "image/webp", ImageMetadata(width=processed_width, height=processed_height)
    except Exception as exc:
        raise ValueError(f"Failed to process image: {exc}")


def store_processed_image(file: BinaryIO) -> str:
    processed_bytes, content_type, metadata = process_profile_image(file)
    stored = get_image_storage_service().save(processed_bytes, content_type, metadata)
    return build_internal_file_url(stored.file_id)


def download_and_upload_profile_image(image_url: str, identity_id: str) -> str | None:
    """Download external image, process it, and store using configured backend."""
    del identity_id  # identity_id retained in signature for compatibility

    try:
        response = httpx.get(image_url, timeout=10, follow_redirects=True)
        response.raise_for_status()

        image_data = io.BytesIO(response.content)
        return store_processed_image(image_data)
    except httpx.RequestError as exc:
        logger.warning("Failed to download profile image from %s: %s", image_url, exc)
        return None
    except httpx.HTTPStatusError as exc:
        logger.warning("HTTP error downloading profile image from %s: %s", image_url, exc)
        return None
    except ValueError as exc:
        logger.warning("Failed to process profile image from %s: %s", image_url, exc)
        return None
    except Exception as exc:
        logger.warning("Unexpected error processing profile image from %s: %s", image_url, exc)
        return None


def allowed_image_content_type(content_type: str | None) -> bool:
    return bool(content_type and content_type in _ALLOWED_IMAGE_TYPES)
