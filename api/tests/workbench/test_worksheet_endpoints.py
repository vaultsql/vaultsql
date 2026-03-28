"""
Tests for workbench worksheet and folder API endpoints.

Includes security tests to verify user isolation.
"""

import json
import pytest
from django.test import Client

from workbench.models import Folder, Worksheet, WorksheetVersion


@pytest.fixture
def client():
    return Client()


# ============ Folder CRUD Tests ============

@pytest.mark.django_db
class TestFolderEndpoints:
    def test_list_folders_empty(self, client, user_session, database):
        response = client.get(
            f"/api/workbench/folders?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_list_folders_requires_database_id(self, client, user_session):
        """database_id is required for listing folders."""
        response = client.get(
            "/api/workbench/folders",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 422  # Missing required param

    def test_list_folders(self, client, user_session, database, folder):
        response = client.get(
            f"/api/workbench/folders?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Folder"
        assert data[0]["database_id"] == str(database.id)

    def test_list_folders_database_isolation(self, client, user_session, database, other_database, folder, other_database_folder):
        """Folders from other databases should not be returned."""
        response = client.get(
            f"/api/workbench/folders?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        folder_ids = [f["id"] for f in data]
        assert str(other_database_folder.id) not in folder_ids

    def test_create_folder(self, client, user_session, database):
        response = client.post(
            "/api/workbench/folders",
            data=json.dumps({"database_id": str(database.id), "name": "New Folder"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Folder"
        assert data["database_id"] == str(database.id)
        assert data["position"] == 1

    def test_create_folder_with_position(self, client, user_session, database):
        response = client.post(
            "/api/workbench/folders",
            data=json.dumps({"database_id": str(database.id), "name": "Positioned Folder", "position": 5}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["position"] == 5

    def test_create_folder_duplicate_name(self, client, user_session, database, folder):
        response = client.post(
            "/api/workbench/folders",
            data=json.dumps({"database_id": str(database.id), "name": "Test Folder"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_create_folder_same_name_different_database(self, client, user_session, database, other_database, folder):
        """Same folder name on different database should work."""
        response = client.post(
            "/api/workbench/folders",
            data=json.dumps({"database_id": str(other_database.id), "name": "Test Folder"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["database_id"] == str(other_database.id)

    def test_update_folder(self, client, user_session, folder):
        response = client.patch(
            f"/api/workbench/folders/{folder.id}",
            data=json.dumps({"name": "Updated Name", "position": 10}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["position"] == 10

    def test_delete_folder(self, client, user_session, folder):
        response = client.delete(
            f"/api/workbench/folders/{folder.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert not Folder.objects.filter(id=folder.id).exists()

    def test_delete_folder_moves_worksheets_to_root(self, client, user_session, folder, worksheet):
        response = client.delete(
            f"/api/workbench/folders/{folder.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        worksheet.refresh_from_db()
        assert worksheet.folder is None


# ============ Worksheet CRUD Tests ============

@pytest.mark.django_db
class TestWorksheetEndpoints:
    def test_list_worksheets_empty(self, client, user_session, database):
        response = client.get(
            f"/api/workbench/worksheets?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_list_worksheets_requires_database_id(self, client, user_session):
        """database_id is required for listing worksheets."""
        response = client.get(
            "/api/workbench/worksheets",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 422  # Missing required param

    def test_list_worksheets(self, client, user_session, database, worksheet, root_worksheet):
        response = client.get(
            f"/api/workbench/worksheets?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_worksheets_database_isolation(self, client, user_session, database, other_database, worksheet, root_worksheet, other_database_worksheet):
        """Worksheets from other databases should not be returned."""
        response = client.get(
            f"/api/workbench/worksheets?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        worksheet_ids = [w["id"] for w in data]
        assert str(other_database_worksheet.id) not in worksheet_ids

    def test_list_worksheets_filter_by_folder(self, client, user_session, database, worksheet, root_worksheet, folder):
        response = client.get(
            f"/api/workbench/worksheets?database_id={database.id}&folder_id={folder.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Worksheet"

    def test_list_worksheets_filter_by_root(self, client, user_session, database, worksheet, root_worksheet):
        response = client.get(
            f"/api/workbench/worksheets?database_id={database.id}&folder_id=root",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Root Worksheet"

    def test_create_worksheet(self, client, user_session, database):
        response = client.post(
            "/api/workbench/worksheets",
            data=json.dumps({
                "database_id": str(database.id),
                "name": "New Worksheet",
                "content": "SELECT NOW();",
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Worksheet"
        assert data["content"] == "SELECT NOW();"
        assert data["database_id"] == str(database.id)
        assert data["folder_id"] is None
        
        # Verify version was created
        worksheet = Worksheet.objects.get(id=data["id"])
        assert worksheet.versions.count() == 1

    def test_create_worksheet_in_folder(self, client, user_session, database, folder):
        response = client.post(
            "/api/workbench/worksheets",
            data=json.dumps({
                "database_id": str(database.id),
                "name": "Folder Worksheet",
                "content": "SELECT 1;",
                "folder_id": str(folder.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["folder_id"] == str(folder.id)

    def test_create_worksheet_duplicate_name_in_folder(self, client, user_session, database, worksheet, folder):
        response = client.post(
            "/api/workbench/worksheets",
            data=json.dumps({
                "database_id": str(database.id),
                "name": "Test Worksheet",  # Same name as existing
                "folder_id": str(folder.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_create_worksheet_same_name_different_folder(self, client, user_session, database, worksheet, folder):
        # Same name but at root level should work
        response = client.post(
            "/api/workbench/worksheets",
            data=json.dumps({
                "database_id": str(database.id),
                "name": "Test Worksheet",  # Same name as in folder
                # No folder_id = root
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200

    def test_create_worksheet_same_name_different_database(self, client, user_session, database, other_database, worksheet, other_database_folder):
        """Same name on different database should work."""
        response = client.post(
            "/api/workbench/worksheets",
            data=json.dumps({
                "database_id": str(other_database.id),
                "name": "Test Worksheet",  # Same name as existing but different database
                "folder_id": str(other_database_folder.id),  # Use folder on the other database
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["database_id"] == str(other_database.id)

    def test_get_worksheet(self, client, user_session, worksheet):
        response = client.get(
            f"/api/workbench/worksheets/{worksheet.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Worksheet"
        assert data["content"] == "SELECT * FROM users;"
        assert "database_id" in data

    def test_update_worksheet_content(self, client, user_session, worksheet):
        response = client.patch(
            f"/api/workbench/worksheets/{worksheet.id}",
            data=json.dumps({"content": "SELECT * FROM accounts;"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "SELECT * FROM accounts;"
        
        # Verify version was created
        worksheet.refresh_from_db()
        assert worksheet.versions.count() == 1

    def test_update_worksheet_name_no_version(self, client, user_session, worksheet):
        initial_version_count = worksheet.versions.count()
        
        response = client.patch(
            f"/api/workbench/worksheets/{worksheet.id}",
            data=json.dumps({"name": "Renamed Worksheet"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        
        # Name change should NOT create a version
        worksheet.refresh_from_db()
        assert worksheet.versions.count() == initial_version_count

    def test_update_worksheet_move_to_root(self, client, user_session, worksheet):
        assert worksheet.folder is not None
        
        response = client.patch(
            f"/api/workbench/worksheets/{worksheet.id}",
            data=json.dumps({"folder_id": ""}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["folder_id"] is None

    def test_delete_worksheet(self, client, user_session, worksheet):
        worksheet_id = worksheet.id
        response = client.delete(
            f"/api/workbench/worksheets/{worksheet_id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        assert response.json()["success"] is True
        assert not Worksheet.objects.filter(id=worksheet_id).exists()


# ============ Security / Isolation Tests ============

@pytest.mark.django_db
class TestWorkbenchSecurity:
    """Tests to verify user isolation and access control."""

    def test_cannot_list_other_user_folders(self, client, user_session, database, other_user_folder):
        """User should not see folders created by another user."""
        response = client.get(
            f"/api/workbench/folders?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        # Should not contain other user's folder
        folder_ids = [f["id"] for f in data]
        assert str(other_user_folder.id) not in folder_ids

    def test_cannot_access_other_user_folder_via_update(self, client, user_session, other_user_folder):
        """User should not be able to access another user's folder via update."""
        # Note: There's no single-folder GET endpoint by design (list returns all data)
        # We test access control via the update endpoint
        response = client.patch(
            f"/api/workbench/folders/{other_user_folder.id}",
            data=json.dumps({"name": "Access Test"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        # Should get 404 (not 403) to not leak existence
        assert response.status_code == 404

    def test_cannot_update_other_user_folder(self, client, user_session, other_user_folder):
        """User should not be able to update another user's folder."""
        response = client.patch(
            f"/api/workbench/folders/{other_user_folder.id}",
            data=json.dumps({"name": "Hacked"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404

    def test_cannot_delete_other_user_folder(self, client, user_session, other_user_folder):
        """User should not be able to delete another user's folder."""
        response = client.delete(
            f"/api/workbench/folders/{other_user_folder.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404
        # Verify folder still exists
        assert Folder.objects.filter(id=other_user_folder.id).exists()

    def test_cannot_list_other_user_worksheets(self, client, user_session, database, other_user_worksheet):
        """User should not see worksheets created by another user."""
        response = client.get(
            f"/api/workbench/worksheets?database_id={database.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        worksheet_ids = [w["id"] for w in data]
        assert str(other_user_worksheet.id) not in worksheet_ids

    def test_cannot_access_other_user_worksheet(self, client, user_session, other_user_worksheet):
        """User should not be able to access another user's worksheet."""
        response = client.get(
            f"/api/workbench/worksheets/{other_user_worksheet.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404

    def test_cannot_update_other_user_worksheet(self, client, user_session, other_user_worksheet):
        """User should not be able to update another user's worksheet."""
        response = client.patch(
            f"/api/workbench/worksheets/{other_user_worksheet.id}",
            data=json.dumps({"content": "DROP TABLE users;"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404
        # Verify content unchanged
        other_user_worksheet.refresh_from_db()
        assert other_user_worksheet.content == "SELECT * FROM secrets;"

    def test_cannot_delete_other_user_worksheet(self, client, user_session, other_user_worksheet):
        """User should not be able to delete another user's worksheet."""
        response = client.delete(
            f"/api/workbench/worksheets/{other_user_worksheet.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404
        assert Worksheet.objects.filter(id=other_user_worksheet.id).exists()

    def test_cannot_create_worksheet_in_other_user_folder(self, client, user_session, database, other_user_folder):
        """User should not be able to create worksheet in another user's folder."""
        response = client.post(
            "/api/workbench/worksheets",
            data=json.dumps({
                "database_id": str(database.id),
                "name": "Sneaky Worksheet",
                "folder_id": str(other_user_folder.id),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404

    def test_cannot_move_worksheet_to_other_user_folder(self, client, user_session, worksheet, other_user_folder):
        """User should not be able to move their worksheet to another user's folder."""
        response = client.patch(
            f"/api/workbench/worksheets/{worksheet.id}",
            data=json.dumps({"folder_id": str(other_user_folder.id)}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404
        # Verify worksheet folder unchanged
        worksheet.refresh_from_db()
        assert worksheet.folder_id != other_user_folder.id

    def test_cannot_filter_worksheets_by_other_user_folder(self, client, user_session, database, other_user_folder):
        """User should not be able to filter worksheets by another user's folder."""
        response = client.get(
            f"/api/workbench/worksheets?database_id={database.id}&folder_id={other_user_folder.id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        assert response.status_code == 404

    def test_cross_workspace_isolation(self, client, other_workspace_session, folder, worksheet):
        """User from different workspace should not see resources from another workspace."""
        # Try to access folder from different workspace
        response = client.patch(
            f"/api/workbench/folders/{folder.id}",
            data=json.dumps({"name": "Cross-workspace hack"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {other_workspace_session.token}",
        )
        assert response.status_code == 404

        # Try to access worksheet from different workspace
        response = client.get(
            f"/api/workbench/worksheets/{worksheet.id}",
            HTTP_AUTHORIZATION=f"Bearer {other_workspace_session.token}",
        )
        assert response.status_code == 404

    def test_unauthenticated_access_denied(self, client, database, folder, worksheet):
        """Unauthenticated requests should be rejected."""
        # No auth header
        response = client.get(f"/api/workbench/folders?database_id={database.id}")
        assert response.status_code == 401

        response = client.get(f"/api/workbench/worksheets?database_id={database.id}")
        assert response.status_code == 401

        response = client.get(f"/api/workbench/worksheets/{worksheet.id}")
        assert response.status_code == 401


# ============ Version History Tests ============

@pytest.mark.django_db
class TestWorksheetVersioning:
    def test_version_created_on_content_change(self, client, user_session, worksheet):
        # Make multiple content changes
        for i in range(3):
            response = client.patch(
                f"/api/workbench/worksheets/{worksheet.id}",
                data=json.dumps({"content": f"SELECT {i};"}),
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
            )
            assert response.status_code == 200

        worksheet.refresh_from_db()
        assert worksheet.versions.count() == 3

    def test_version_not_created_on_unchanged_content(self, client, user_session, worksheet):
        # Create initial version
        client.patch(
            f"/api/workbench/worksheets/{worksheet.id}",
            data=json.dumps({"content": "SELECT 1;"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        initial_count = worksheet.versions.count()

        # Update with same content
        client.patch(
            f"/api/workbench/worksheets/{worksheet.id}",
            data=json.dumps({"content": "SELECT 1;"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )
        
        worksheet.refresh_from_db()
        assert worksheet.versions.count() == initial_count

    def test_versions_deleted_with_worksheet(self, client, user_session, worksheet):
        # Create some versions
        for i in range(3):
            client.patch(
                f"/api/workbench/worksheets/{worksheet.id}",
                data=json.dumps({"content": f"SELECT {i};"}),
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
            )
        
        worksheet_id = worksheet.id
        version_count = WorksheetVersion.objects.filter(worksheet_id=worksheet_id).count()
        assert version_count > 0

        # Delete worksheet
        client.delete(
            f"/api/workbench/worksheets/{worksheet_id}",
            HTTP_AUTHORIZATION=f"Bearer {user_session.token}",
        )

        # Versions should be cascade deleted
        assert WorksheetVersion.objects.filter(worksheet_id=worksheet_id).count() == 0
