import json
import pytest
from django.test import Client

from connection.models import DatabaseTag


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def tag(managed_workspace):
    """Create a test tag."""
    return DatabaseTag.objects.create(
        workspace=managed_workspace,
        name="test-tag",
        color="#3b82f6",
    )


@pytest.fixture
def tag2(managed_workspace):
    """Create a second test tag."""
    return DatabaseTag.objects.create(
        workspace=managed_workspace,
        name="another-tag",
        color="#10b981",
    )


@pytest.mark.django_db
class TestTagEndpoints:
    def test_list_tags(self, client, admin_session, tag, tag2):
        """Test listing all tags in workspace."""
        response = client.get(
            "/api/tag/",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["name"] == "another-tag"  # Ordered by name
        assert data[1]["name"] == "test-tag"

    def test_list_tags_member_allowed(self, client, member_session, tag):
        """Test that members can list tags."""
        response = client.get(
            "/api/tag/",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_create_tag(self, client, admin_session):
        """Test creating a new tag."""
        response = client.post(
            "/api/tag/",
            data=json.dumps({
                "name": "production",
                "color": "#ef4444"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "production"
        assert data["color"] == "#ef4444"
        assert "id" in data
        assert "created_at" in data

    def test_create_tag_member_forbidden(self, client, member_session):
        """Test that members cannot create tags."""
        response = client.post(
            "/api/tag/",
            data=json.dumps({
                "name": "staging",
                "color": "#f59e0b"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403

    def test_create_tag_duplicate_name(self, client, admin_session, tag):
        """Test that duplicate tag names are rejected."""
        response = client.post(
            "/api/tag/",
            data=json.dumps({
                "name": "test-tag",
                "color": "#000000"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data["detail"]

    def test_get_tag(self, client, admin_session, tag):
        """Test getting a specific tag."""
        response = client.get(
            f"/api/tag/{tag.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(tag.id)
        assert data["name"] == "test-tag"
        assert data["color"] == "#3b82f6"

    def test_get_tag_not_found(self, client, admin_session):
        """Test getting a non-existent tag."""
        response = client.get(
            "/api/tag/00000000-0000-0000-0000-000000000000",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 404

    def test_update_tag(self, client, admin_session, tag):
        """Test updating a tag."""
        response = client.patch(
            f"/api/tag/{tag.id}",
            data=json.dumps({
                "name": "updated-tag",
                "color": "#ff0000"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "updated-tag"
        assert data["color"] == "#ff0000"

    def test_update_tag_member_forbidden(self, client, member_session, tag):
        """Test that members cannot update tags."""
        response = client.patch(
            f"/api/tag/{tag.id}",
            data=json.dumps({
                "name": "hacked-tag"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403

    def test_update_tag_duplicate_name(self, client, admin_session, tag, tag2):
        """Test that updating to a duplicate name is rejected."""
        response = client.patch(
            f"/api/tag/{tag.id}",
            data=json.dumps({
                "name": "another-tag"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data["detail"]

    def test_delete_tag(self, client, admin_session, tag):
        """Test deleting a tag."""
        response = client.delete(
            f"/api/tag/{tag.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Verify tag is deleted
        assert not DatabaseTag.objects.filter(id=tag.id).exists()

    def test_delete_tag_member_forbidden(self, client, member_session, tag):
        """Test that members cannot delete tags."""
        response = client.delete(
            f"/api/tag/{tag.id}",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403

    def test_delete_tag_in_use(self, client, admin_session, tag, database):
        """Test that tags in use cannot be deleted."""
        # Assign tag to database
        database.tags.add(tag)
        
        response = client.delete(
            f"/api/tag/{tag.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400
        data = response.json()
        assert "is used by" in data["detail"]
        assert "1 database" in data["detail"]
        
        # Verify tag still exists
        assert DatabaseTag.objects.filter(id=tag.id).exists()

    def test_workspace_isolation(self, client, admin_session, vault_admin_session, managed_workspace, vault_workspace):
        """Test that tags are isolated by workspace."""
        # Create tag in managed workspace
        tag1 = DatabaseTag.objects.create(
            workspace=managed_workspace,
            name="managed-tag",
            color="#000000",
        )
        
        # Create tag in vault workspace
        tag2 = DatabaseTag.objects.create(
            workspace=vault_workspace,
            name="vault-tag",
            color="#ffffff",
        )
        
        # Admin in managed workspace should only see managed-tag
        response = client.get(
            "/api/tag/",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        tag_names = [t["name"] for t in data]
        assert "managed-tag" in tag_names
        assert "vault-tag" not in tag_names
        
        # Vault admin should only see vault-tag
        response = client.get(
            "/api/tag/",
            HTTP_AUTHORIZATION=f"Bearer {vault_admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        tag_names = [t["name"] for t in data]
        assert "vault-tag" in tag_names
        assert "managed-tag" not in tag_names
