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
class TestDatabaseEndpoints:
    def test_create_database(self, client, admin_session):
        response = client.post(
            "/api/database/",
            data=json.dumps({
                "name": "New Database",
                "database_type": "postgres",
                "description": "Test database"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Database"
        assert data["database_type"] == "postgres"

    def test_create_database_member_forbidden(self, client, member_session):
        response = client.post(
            "/api/database/",
            data=json.dumps({
                "name": "New Database",
                "database_type": "postgres"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403

    def test_list_databases(self, client, admin_session, database):
        response = client.get(
            "/api/database/",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_get_database(self, client, admin_session, database):
        response = client.get(
            f"/api/database/{database.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(database.id)
        assert data["name"] == database.name

    def test_update_database(self, client, admin_session, database):
        response = client.patch(
            f"/api/database/{database.id}",
            data=json.dumps({
                "name": "Updated Database Name",
                "description": "Updated description"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Database Name"

    def test_delete_database(self, client, admin_session, database):
        response = client.delete(
            f"/api/database/{database.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_database_with_environment(self, client, admin_session):
        """Test creating a database with environment field."""
        response = client.post(
            "/api/database/",
            data=json.dumps({
                "name": "Production Database",
                "database_type": "postgres",
                "description": "Production database",
                "environment": "production"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Production Database"
        assert data["environment"] == "production"

    def test_update_database_environment(self, client, admin_session, database):
        """Test updating database environment."""
        response = client.patch(
            f"/api/database/{database.id}",
            data=json.dumps({
                "environment": "staging"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["environment"] == "staging"

    def test_update_database_tags(self, client, admin_session, database, tag, tag2):
        """Test updating database tags."""
        response = client.patch(
            f"/api/database/{database.id}",
            data=json.dumps({
                "tag_ids": [str(tag.id), str(tag2.id)]
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["tags"]) == 2
        assert str(tag.id) in data["tags"]
        assert str(tag2.id) in data["tags"]

    def test_database_response_includes_new_fields(self, client, admin_session, database, tag):
        """Test that database responses include environment and tags."""
        # Add environment and tag to database
        database.environment = "production"
        database.save()
        database.tags.add(tag)
        
        response = client.get(
            f"/api/database/{database.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert "environment" in data
        assert data["environment"] == "production"
        assert "tags" in data
        assert isinstance(data["tags"], list)
        assert str(tag.id) in data["tags"]


@pytest.mark.django_db
class TestDatabaseCredentialEndpoints:
    def test_set_database_credentials_managed_mode(self, client, admin_session, database):
        response = client.post(
            f"/api/database/{database.id}/credentials",
            data=json.dumps({
                "credentials": {
                    "hostname": "localhost",
                    "port": 5432,
                    "ssl_mode": "prefer"
                }
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_set_database_credentials_invalid_schema(self, client, admin_session, database):
        response = client.post(
            f"/api/database/{database.id}/credentials",
            data=json.dumps({
                "credentials": {
                    "invalid_field": "value"
                }
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid credentials" in data["detail"]

    def test_set_database_credentials_member_forbidden(self, client, member_session, database):
        response = client.post(
            f"/api/database/{database.id}/credentials",
            data=json.dumps({
                "credentials": {"host": "localhost"}
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {member_session.token}",
        )
        assert response.status_code == 403

    def test_get_database_credentials_no_creds(self, client, admin_session, database):
        response = client.post(
            f"/api/database/{database.id}/credentials/get",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        # Should return 404 if no credentials set
        assert response.status_code == 404


@pytest.mark.django_db
class TestDatabaseAccountEndpoints:
    def test_create_account(self, client, admin_session, database):
        response = client.post(
            f"/api/database/{database.id}/accounts",
            data=json.dumps({
                "name": "New Account",
                "description": "Test account"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Account"

    def test_list_accounts(self, client, admin_session, database, database_account):
        response = client.get(
            f"/api/database/{database.id}/accounts",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_update_account(self, client, admin_session, database, database_account):
        response = client.patch(
            f"/api/database/{database.id}/accounts/{database_account.id}",
            data=json.dumps({
                "name": "Updated Account",
                "description": "Updated"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Account"

    def test_delete_account(self, client, admin_session, database, database_account):
        response = client.delete(
            f"/api/database/{database.id}/accounts/{database_account.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_account_with_access_level(self, client, admin_session, database):
        """Test creating an account with access_level field."""
        response = client.post(
            f"/api/database/{database.id}/accounts",
            data=json.dumps({
                "name": "Admin Account",
                "description": "Full access account",
                "access_level": "admin"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Admin Account"
        assert data["access_level"] == "admin"

    def test_create_account_default_access_level(self, client, admin_session, database):
        """Test that accounts default to readonly access level."""
        response = client.post(
            f"/api/database/{database.id}/accounts",
            data=json.dumps({
                "name": "Default Account",
                "description": "Account with default access"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["access_level"] == "readonly"

    def test_update_account_access_level(self, client, admin_session, database, database_account):
        """Test updating account access level."""
        response = client.patch(
            f"/api/database/{database.id}/accounts/{database_account.id}",
            data=json.dumps({
                "access_level": "write"
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["access_level"] == "write"

    def test_account_response_includes_access_level(self, client, admin_session, database, database_account):
        """Test that account responses include access_level."""
        response = client.get(
            f"/api/database/{database.id}/accounts/{database_account.id}",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_level" in data
        # Default should be readonly
        assert data["access_level"] in ["readonly", "write", "admin"]


@pytest.mark.django_db
class TestAccountCredentialEndpoints:
    def test_set_account_credentials_managed_mode(self, client, admin_session, database, database_account):
        response = client.post(
            f"/api/database/{database.id}/accounts/{database_account.id}/credentials",
            data=json.dumps({
                "credentials": {
                    "username": "testuser",
                    "password": "testpass",
                }
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_set_account_credentials_invalid_schema(self, client, admin_session, database, database_account):
        response = client.post(
            f"/api/database/{database.id}/accounts/{database_account.id}/credentials",
            data=json.dumps({
                "credentials": {
                    "invalid_field": "value"
                }
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid credentials" in data["detail"]

    def test_get_account_credentials_no_creds(self, client, admin_session, database, database_account):
        response = client.post(
            f"/api/database/{database.id}/accounts/{database_account.id}/credentials/get",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {admin_session.token}",
        )
        # Should return 404 if no credentials set
        assert response.status_code == 404
