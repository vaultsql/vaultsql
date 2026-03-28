"""
End-to-end integration tests that run against live services.

These tests use HTTP requests (not Django test client) and run in a Docker test environment.

TO RUN:

    task test:e2e

Or manually:

    docker compose -f docker-compose.test.yml up -d --wait
    docker compose -f docker-compose.test.yml exec -T test_runner uv run python manage.py migrate --noinput
    docker compose -f docker-compose.test.yml exec -T test_runner uv run pytest tests/integration -m integration -v
    docker compose -f docker-compose.test.yml down -v

These tests are NOT run by default (excluded via pytest.ini).
Go service tests are automatically skipped if the service is unavailable.
"""

import os
import secrets
import uuid
import pytest
import requests


# Service URLs from environment
DJANGO_URL = os.environ.get("DJANGO_URL", "http://localhost:8000")
QUERY_SERVICE_URL = os.environ.get(
    "QUERY_SERVICE_URL", "http://localhost:9005"
)  # Changed: 9000 → 9005

# Database credentials - use env vars with localhost defaults
DB_PASSWORD = os.environ.get("TEST_ADMIN_PASS", "demo_admin_pass")
DB_NAME = os.environ.get("TEST_PG_DB_NAME", "kitchen_sink")
DB_HOST = os.environ.get("TEST_PG_HOST", "localhost")
DB_PORT = int(os.environ.get("TEST_PG_PORT", "5432"))
DB_USER = os.environ.get("TEST_ADMIN_USER", "demo_admin")
MYSQL_PASSWORD = os.environ.get("TEST_ADMIN_PASS", "demo_admin_pass")
MYSQL_NAME = os.environ.get("TEST_MYSQL_DB_NAME", "kitchen_sink")
MYSQL_HOST = os.environ.get("TEST_MYSQL_HOST", "localhost")
MYSQL_PORT = int(os.environ.get("TEST_MYSQL_PORT", "3307"))
MYSQL_USER = os.environ.get("TEST_ADMIN_USER", "demo_admin")
SSH_HOST = os.environ.get("TEST_SSH_HOST", "bastion")  # Changed: IP → bastion
SSH_PORT = int(os.environ.get("TEST_SSH_PORT", "22"))
SSH_USER = os.environ.get("TEST_SSH_USER", "sshdemo")

# Test-specific vault passphrase (different from seed_dev for test isolation)
VAULT_PASSPHRASE = "crystal blue sky mountain river forest ocean desert"

def api(path: str) -> str:
    """Build Django API URL."""
    return f"{DJANGO_URL.rstrip('/')}{path}"


def query_api(path: str) -> str:
    """Build Go query service URL."""
    return f"{QUERY_SERVICE_URL.rstrip('/')}{path}"


def unique_email() -> str:
    """Generate a unique test email."""
    return f"test-{secrets.token_hex(8)}@example.com"


def unique_slug() -> str:
    """Generate a unique workspace slug."""
    return f"test-{secrets.token_hex(8)}"


class IntegrationTestClient:
    """HTTP client for integration tests with auth helpers."""

    def __init__(self):
        self.session = requests.Session()
        self.token: str | None = None
        self.identity_token: str | None = None

    def set_token(self, token: str):
        """Set the auth token for subsequent requests."""
        self.token = token
        self.session.headers["Authorization"] = f"Bearer {token}"

    def clear_token(self):
        """Clear the auth token."""
        self.token = None
        self.session.headers.pop("Authorization", None)

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.session.get(api(path), **kwargs)

    def post(self, path: str, json=None, **kwargs) -> requests.Response:
        return self.session.post(api(path), json=json, **kwargs)

    def query_service_post(self, path: str, json=None, **kwargs) -> requests.Response:
        """POST to Go query service. Raises pytest.skip if service unavailable."""
        headers = kwargs.pop("headers", {})
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        try:
            return requests.post(
                query_api(path), json=json, headers=headers, timeout=5, **kwargs
            )
        except requests.exceptions.ConnectionError:
            pytest.skip(f"Go query service not available at {QUERY_SERVICE_URL}")

    # Auth helpers
    def signup(
        self,
        email: str,
        password: str,
        name: str = "Test User",
    ) -> dict:
        """Sign up a new identity and return the response data."""
        resp = self.post(
            "/api/auth/signup",
            json={
                "email": email,
                "password": password,
                "name": name,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        self.identity_token = data["token"]
        self.set_token(data["token"])
        return data

    def login(self, email: str, password: str) -> dict:
        """Login and return the response data."""
        resp = self.post(
            "/api/auth/login",
            json={
                "email": email,
                "password": password,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        self.set_token(data["token"])
        return data

    def create_workspace(
        self,
        name: str,
        slug: str,
        mode: str = "streamlined",
        user_name: str = "Test User",
    ) -> dict:
        """Create a new workspace (requires identity token)."""
        resp = self.post(
            "/api/identity/workspace",
            json={
                "name": name,
                "slug": slug,
                "mode": mode,
                "user_name": user_name,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        self.set_token(data["token"])
        return data

    def get_me(self) -> dict:
        """Get current user info."""
        resp = self.get("/api/user/me")
        resp.raise_for_status()
        return resp.json()

    def get_identity_me(self) -> dict:
        """Get current identity info."""
        resp = self.get("/api/identity/me")
        resp.raise_for_status()
        return resp.json()

    def list_workspaces(self) -> list:
        """List workspaces for current identity."""
        resp = self.get("/api/identity/workspace")
        resp.raise_for_status()
        return resp.json()

    def workspace_login(self, workspace_id: str) -> dict:
        """Login to a specific workspace."""
        resp = self.post(f"/api/identity/workspace/{workspace_id}/login")
        resp.raise_for_status()
        data = resp.json()
        self.set_token(data["token"])
        return data


@pytest.fixture
def client():
    """Create a fresh integration test client."""
    return IntegrationTestClient()


# ============ Signup & Onboarding Tests ============


@pytest.mark.integration
class TestSignupOnboarding:
    """Test the complete signup and onboarding flow."""

    def test_signup_creates_identity(self, client: IntegrationTestClient):
        """Test that signup creates an identity with needs_onboarding=true."""
        email = unique_email()
        data = client.signup(email, "testpass123")

        assert "token" in data
        assert data["identity"]["email"] == email
        assert data["needs_onboarding"] is True

    def test_new_identity_has_no_workspaces(self, client: IntegrationTestClient):
        """Test that a fresh identity has no workspaces."""
        client.signup(unique_email(), "testpass123")

        workspaces = client.list_workspaces()
        assert workspaces == []

    def test_identity_me_for_new_identity(self, client: IntegrationTestClient):
        """Test identity endpoint returns identity info without workspaces."""
        email = unique_email()
        client.signup(email, "testpass123")

        identity_me = client.get_identity_me()
        assert identity_me["identity"]["email"] == email
        assert identity_me["workspaces"] == []

    def test_create_workspace_completes_onboarding(self, client: IntegrationTestClient):
        """Test that creating a workspace completes onboarding."""
        email = unique_email()
        client.signup(email, "testpass123")

        slug = unique_slug()
        client.create_workspace("Test Workspace", slug, mode="streamlined")

        me = client.get_me()
        assert me["user"]["email"] == email
        assert me["workspace"]["slug"]
        uuid.UUID(me["workspace"]["slug"])
        assert me["workspace"]["role"] == "admin"

    def test_login_existing_user_gets_workspace_session(
        self, client: IntegrationTestClient
    ):
        """Test that logging in an existing user returns workspace session."""
        email = unique_email()
        password = "testpass123"

        # Sign up and create workspace
        client.signup(email, password)
        client.create_workspace("Test Workspace", unique_slug())
        client.clear_token()

        # Login again
        data = client.login(email, password)
        assert data["needs_onboarding"] is False

        # Get workspaces and login to first one
        workspaces = client.list_workspaces()
        assert len(workspaces) >= 1
        client.workspace_login(workspaces[0]["id"])

        # Should be able to access /api/user/me
        me = client.get_me()
        assert me["user"]["email"] == email

    def test_vault_workspace_needs_key_create(self, client: IntegrationTestClient):
        """Test that vault workspace needs key creation (key is None)."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Vault Workspace", unique_slug(), mode="vault")

        me = client.get_me()
        assert me["workspace"]["mode"] == "vault"
        # Infer needs_key_create from key being None
        assert me["key"] is None


# ============ Database & Account Creation Tests ============


def create_direct_database(
    client: IntegrationTestClient, passphrase: str | None = None
) -> tuple[dict, dict]:
    """Create a direct connection database with account. Returns (database, account)."""
    payload = {
        "name": f"Direct Database {secrets.token_hex(4)}",
        "database_type": "postgres",
        "description": "Direct connection to localhost",
        "account_name": "admin",
        "account_description": "Admin profile",
        "database_credentials": {
            "hostname": DB_HOST,
            "port": DB_PORT,
            "database": DB_NAME,
            "ssl_mode": "prefer",
        },
        "account_credentials": {
            "username": DB_USER,
            "password": DB_PASSWORD,
        },
    }

    if passphrase:
        payload["passphrase"] = passphrase

    resp = client.post("/api/database/create", json=payload)
    resp.raise_for_status()
    database = resp.json()

    accounts_resp = client.get(f"/api/database/{database['id']}/accounts")
    accounts_resp.raise_for_status()
    accounts = accounts_resp.json()
    account = accounts[0]  # Wizard creates exactly one account

    return database, account


def create_ssh_database(
    client: IntegrationTestClient, passphrase: str | None = None
) -> tuple[dict, dict]:
    """Create an SSH tunnel database with account. Returns (database, account)."""
    payload = {
        "name": f"SSH Database {secrets.token_hex(4)}",
        "database_type": "postgres",
        "description": "SSH tunnel connection",
        "account_name": "admin",
        "account_description": "Admin profile",
        "database_credentials": {
            "hostname": "test_postgres",
            "port": 5432,
            "database": DB_NAME,
            "ssl_mode": "prefer",
            "ssh": {
                "host": SSH_HOST,
                "port": SSH_PORT,
                "user": SSH_USER,
            },
        },
        "account_credentials": {
            "username": DB_USER,
            "password": DB_PASSWORD,
        },
    }

    if passphrase:
        payload["passphrase"] = passphrase

    resp = client.post("/api/database/create", json=payload)
    resp.raise_for_status()
    database = resp.json()

    accounts_resp = client.get(f"/api/database/{database['id']}/accounts")
    accounts_resp.raise_for_status()
    accounts = accounts_resp.json()
    account = accounts[0]  # Wizard creates exactly one account

    return database, account


def create_mysql_database(
    client: IntegrationTestClient, passphrase: str | None = None
) -> tuple[dict, dict]:
    """Create a MySQL database with account. Returns (database, account)."""
    payload = {
        "name": f"MySQL Database {secrets.token_hex(4)}",
        "database_type": "mysql",
        "description": "Direct connection to MySQL",
        "account_name": "admin",
        "account_description": "Admin profile",
        "database_credentials": {
            "hostname": MYSQL_HOST,
            "port": MYSQL_PORT,
            "database": MYSQL_NAME,
            "ssl_mode": "prefer",
        },
        "account_credentials": {
            "username": MYSQL_USER,
            "password": MYSQL_PASSWORD,
        },
    }

    if passphrase:
        payload["passphrase"] = passphrase

    resp = client.post("/api/database/create", json=payload)
    resp.raise_for_status()
    database = resp.json()

    accounts_resp = client.get(f"/api/database/{database['id']}/accounts")
    accounts_resp.raise_for_status()
    accounts = accounts_resp.json()
    account = accounts[0]

    return database, account


@pytest.mark.integration
class TestStreamlinedQueryWorkflow:
    """Test query execution in streamlined mode."""

    def test_direct_connection_query_via_go_service(
        self, client: IntegrationTestClient
    ):
        """Test query via Go service with direct connection."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Streamlined WS", unique_slug(), mode="streamlined")

        _, account = create_direct_database(client)
        account_id = account["id"]

        resp = client.query_service_post(
            f"/api/account/{account_id}/run",
            json={
                "query": "SELECT 100 as go_value",
            },
        )

        assert resp.status_code == 200, f"Query failed: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["result"][0]["go_value"] == 100

    def test_ssh_connection_query_via_go_service(self, client: IntegrationTestClient):
        """Test query via Go service with SSH tunnel."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Streamlined WS", unique_slug(), mode="streamlined")

        _, account = create_ssh_database(client)
        account_id = account["id"]

        resp = client.query_service_post(
            f"/api/account/{account_id}/run",
            json={
                "query": "SELECT 200 as ssh_go_value",
            },
        )

        assert resp.status_code == 200, f"Query failed: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["result"][0]["ssh_go_value"] == 200


@pytest.mark.integration
class TestVaultQueryWorkflow:
    """Test query execution in vault mode."""

    def _setup_vault_workspace(self, client: IntegrationTestClient) -> tuple[dict, str]:
        """Setup vault workspace with approved key. Returns (key_data, passphrase)."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Vault WS", unique_slug(), mode="vault")

        # Create user key - passphrase is auto-generated and returned
        resp = client.post("/api/keys/create")
        resp.raise_for_status()
        key_data = resp.json()

        # Confirm key so it becomes active (auto-approved for solo admin)
        confirm_resp = client.post("/api/keys/confirm", json={"key_id": key_data["id"]})
        confirm_resp.raise_for_status()

        return key_data, key_data["passphrase"]

    def test_direct_connection_query_via_django(self, client: IntegrationTestClient):
        """Test vault mode query via Go service (called via Django routing)."""
        _, passphrase = self._setup_vault_workspace(client)

        _, account = create_direct_database(client, passphrase=passphrase)
        account_id = account["id"]

        # Get keys
        keys_resp = client.post(
            f"/api/account/{account_id}/keys",
            json={
                "passphrase": passphrase,
            },
        )
        assert keys_resp.status_code == 200
        keys_data = keys_resp.json()

        # Run query with keys via query service
        resp = client.query_service_post(
            f"/api/account/{account_id}/run",
            json={
                "query": "SELECT 3 as vault_value",
                "database_key": keys_data["database_key"],
                "account_key": keys_data["account_key"],
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["result"][0]["vault_value"] == 3

    def test_direct_connection_query_via_go_service(
        self, client: IntegrationTestClient
    ):
        """Test vault mode query via Go service."""
        _, passphrase = self._setup_vault_workspace(client)

        _, account = create_direct_database(client, passphrase=passphrase)
        account_id = account["id"]

        # Get keys
        keys_resp = client.post(
            f"/api/account/{account_id}/keys",
            json={
                "passphrase": passphrase,
            },
        )
        assert keys_resp.status_code == 200
        keys_data = keys_resp.json()

        # Run query via Go service with keys
        resp = client.query_service_post(
            f"/api/account/{account_id}/run",
            json={
                "query": "SELECT 300 as vault_go_value",
                "database_key": keys_data["database_key"],
                "account_key": keys_data["account_key"],
            },
        )

        assert resp.status_code == 200, f"Query failed: {resp.text}"
        data = resp.json()
        assert data["success"] is True
        assert data["result"][0]["vault_go_value"] == 300

    def test_vault_mode_missing_keys_fails(self, client: IntegrationTestClient):
        """Test that vault mode requires keys."""
        _, passphrase = self._setup_vault_workspace(client)

        _, account = create_direct_database(client, passphrase=passphrase)
        account_id = account["id"]

        # Try to run query without keys via query service
        resp = client.query_service_post(
            f"/api/account/{account_id}/run",
            json={
                "query": "SELECT 1",
            },
        )

        assert resp.status_code == 400
        assert "database_key and account_key are required" in resp.json()["detail"]

    def test_wrong_passphrase_fails(self, client: IntegrationTestClient):
        """Test that wrong passphrase fails."""
        _, passphrase = self._setup_vault_workspace(client)

        _, account = create_direct_database(client, passphrase=passphrase)
        account_id = account["id"]

        # Try to get keys with wrong passphrase
        resp = client.post(
            f"/api/account/{account_id}/keys",
            json={
                "passphrase": "wrong passphrase",
            },
        )

        assert resp.status_code == 400


@pytest.mark.integration
class TestQueryErrors:
    """Test error handling in query execution."""

    def test_sql_error_returned(self, client: IntegrationTestClient):
        """Test that SQL errors are properly returned."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Test WS", unique_slug(), mode="streamlined")

        _, account = create_direct_database(client)
        account_id = account["id"]

        resp = client.query_service_post(
            f"/api/account/{account_id}/run",
            json={
                "query": "SELECT * FROM nonexistent_table_xyz",
            },
        )

        # Query service currently returns 500 for SQL errors
        # TODO: Should return 200 with success=False instead
        assert resp.status_code == 500
        data = resp.json()
        assert data["error"] is not None
        assert (
            "nonexistent_table_xyz" in data["error"].lower()
            or "does not exist" in data["error"].lower()
        )

    def test_invalid_token_rejected(self, client: IntegrationTestClient):
        """Test that invalid auth token is rejected."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Test WS", unique_slug(), mode="streamlined")

        _, account = create_direct_database(client)
        account_id = account["id"]

        # Use invalid token
        client.set_token("invalid_token_12345")

        resp = client.query_service_post(
            f"/api/account/{account_id}/run",
            json={
                "query": "SELECT 1",
            },
        )

        assert resp.status_code == 401


@pytest.mark.integration
class TestDatabaseCreationErrors:
    """Test database creation error handling."""

    def test_wrong_credentials_fails(self, client: IntegrationTestClient):
        """Test that wrong database credentials fail."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Test WS", unique_slug(), mode="streamlined")

        resp = client.post(
            "/api/database/create",
            json={
                "name": "Bad Database",
                "database_type": "postgres",
                "description": "Test",
                "account_name": "admin",
                "account_description": "Admin",
                "database_credentials": {
                    "hostname": DB_HOST,
                    "port": DB_PORT,
                    "database": DB_NAME,
                    "ssl_mode": "prefer",
                },
                "account_credentials": {
                    "username": "nonexistent_user_xyz",
                    "password": "wrongpassword",
                },
            },
        )

        assert resp.status_code == 400
        assert (
            "Connection test failed" in resp.json()["detail"]
            or "failed" in resp.json()["detail"].lower()
        )

    def test_wrong_hostname_fails(self, client: IntegrationTestClient):
        """Test that wrong hostname fails."""
        client.signup(unique_email(), "testpass123")
        client.create_workspace("Test WS", unique_slug(), mode="streamlined")

        resp = client.post(
            "/api/database/create",
            json={
                "name": "Bad Database",
                "database_type": "postgres",
                "description": "Test",
                "account_name": "admin",
                "account_description": "Admin",
                "database_credentials": {
                    "hostname": "nonexistent.host.example",
                    "port": DB_PORT,
                    "database": DB_NAME,
                    "ssl_mode": "prefer",
                },
                "account_credentials": {
                    "username": "admin",
                    "password": DB_PASSWORD,
                },
            },
        )

        assert resp.status_code == 400
        assert "Connection test failed" in resp.json()["detail"]

