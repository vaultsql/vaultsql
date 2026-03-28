import io
from unittest.mock import Mock, patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

from accounts.models import ImageBlob


pytestmark = pytest.mark.django_db


def _make_test_image_file(name: str = "avatar.png", size: tuple[int, int] = (1200, 400), fmt: str = "PNG"):
    image = Image.new("RGB", size, color=(255, 0, 0))
    output = io.BytesIO()
    image.save(output, format=fmt)
    output.seek(0)
    return SimpleUploadedFile(name=name, content=output.read(), content_type=f"image/{fmt.lower()}")


def _extract_file_id(image_url: str) -> str:
    assert image_url.startswith("/api/file/")
    return image_url.rsplit("/", 1)[-1]


class TestAvatarUpload:
    def test_avatar_upload_returns_internal_file_url(self, client, session):
        response = client.post(
            "/api/user/avatar",
            {"file": _make_test_image_file()},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["image_url"].startswith("/api/file/")

        file_id = _extract_file_id(data["image_url"])
        blob = ImageBlob.objects.get(id=file_id)
        assert blob.storage_backend == "db"
        assert blob.content_type == "image/webp"
        assert blob.width <= 512
        assert blob.height <= 512

    def test_avatar_upload_rejects_invalid_type(self, client, session):
        bad_file = SimpleUploadedFile("bad.txt", b"hello", content_type="text/plain")

        response = client.post(
            "/api/user/avatar",
            {"file": bad_file},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )

        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    def test_avatar_upload_rejects_large_file(self, client, session):
        large_content = b"x" * (10 * 1024 * 1024 + 1)
        large_file = SimpleUploadedFile("large.png", large_content, content_type="image/png")

        response = client.post(
            "/api/user/avatar",
            {"file": large_file},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )

        assert response.status_code == 400
        assert "less than 10MB" in response.json()["detail"]

    def test_avatar_replacement_cleans_up_old_internal_blob(self, client, session):
        first = client.post(
            "/api/user/avatar",
            {"file": _make_test_image_file(name="first.png", size=(600, 600))},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )
        assert first.status_code == 200
        first_id = _extract_file_id(first.json()["image_url"])
        assert ImageBlob.objects.filter(id=first_id).exists()

        second = client.post(
            "/api/user/avatar",
            {"file": _make_test_image_file(name="second.png", size=(700, 300))},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )
        assert second.status_code == 200

        assert not ImageBlob.objects.filter(id=first_id).exists()


class TestWorkspaceImageUpload:
    def test_workspace_image_upload_returns_internal_file_url(self, client, session):
        response = client.post(
            "/api/workspace/image",
            {"file": _make_test_image_file(name="workspace.png", size=(900, 1200))},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["image_url"].startswith("/api/file/")


class TestFileDownloadEndpoint:
    def test_download_db_file(self, client, session):
        upload = client.post(
            "/api/user/avatar",
            {"file": _make_test_image_file()},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )
        assert upload.status_code == 200

        image_url = upload.json()["image_url"]
        file_id = _extract_file_id(image_url)

        response = client.get(f"/api/file/{file_id}")
        assert response.status_code == 200
        assert response["Content-Type"] == "image/webp"
        assert response["Content-Disposition"].startswith("inline;")
        assert response["Cache-Control"] == "public, max-age=31536000, immutable"
        assert "ETag" in response
        assert len(response.content) > 0

    def test_download_missing_file_returns_404(self, client):
        response = client.get("/api/file/00000000-0000-0000-0000-000000000001")
        assert response.status_code == 404

    def test_download_with_attachment_mode(self, client, session):
        upload = client.post(
            "/api/user/avatar",
            {"file": _make_test_image_file()},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )
        file_id = _extract_file_id(upload.json()["image_url"])

        response = client.get(f"/api/file/{file_id}?download=true")
        assert response.status_code == 200
        assert response["Content-Disposition"].startswith("attachment;")

    @override_settings(ENABLE_R2=True)
    @patch("accounts.storage.boto3.client")
    def test_upload_uses_s3_backend_when_enabled(self, mock_boto_client, client, session):
        mock_client = Mock()
        mock_boto_client.return_value = mock_client

        response = client.post(
            "/api/user/avatar",
            {"file": _make_test_image_file()},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )

        assert response.status_code == 200
        file_id = _extract_file_id(response.json()["image_url"])
        blob = ImageBlob.objects.get(id=file_id)
        assert blob.storage_backend == "s3"
        assert blob.object_key is not None
        mock_client.put_object.assert_called_once()

    @override_settings(ENABLE_R2=True)
    @patch("accounts.storage.boto3.client")
    def test_download_s3_file(self, mock_boto_client, client):
        mock_client = Mock()
        mock_client.get_object.return_value = {"Body": io.BytesIO(b"s3-image-bytes")}
        mock_boto_client.return_value = mock_client

        blob = ImageBlob.objects.create(
            storage_backend="s3",
            content_type="image/webp",
            byte_size=len(b"s3-image-bytes"),
            width=100,
            height=100,
            sha256="a" * 64,
            object_key="images/test.webp",
        )

        response = client.get(f"/api/file/{blob.id}")
        assert response.status_code == 200
        assert response.content == b"s3-image-bytes"
        assert response["Content-Type"] == "image/webp"
        mock_client.get_object.assert_called_once()

    @override_settings(ENABLE_R2=True)
    @patch("accounts.storage.boto3.client")
    def test_s3_save_failure_falls_back_to_db(self, mock_boto_client, client, session):
        mock_client = Mock()
        mock_client.put_object.side_effect = RuntimeError("s3 down")
        mock_boto_client.return_value = mock_client

        response = client.post(
            "/api/user/avatar",
            {"file": _make_test_image_file()},
            HTTP_AUTHORIZATION=f"Bearer {session.token}",
        )

        assert response.status_code == 200
        file_id = _extract_file_id(response.json()["image_url"])
        blob = ImageBlob.objects.get(id=file_id)
        assert blob.storage_backend == "db"
        assert blob.blob_data is not None
