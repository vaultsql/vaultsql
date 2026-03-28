"""
MySQL adapter - types and validation.

Database credentials: hostname, port, database, SSL config, SSH tunnel config
Account credentials: username, password
"""

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel

from connection.adapters.base import BaseAdapter
from connection.models import DatabaseType


# ============ Types ============

class SSLMode(str, Enum):
    DISABLE = "disable"
    PREFER = "prefer"
    REQUIRE = "require"


class MySQLSSHConfig(BaseModel):
    """SSH tunnel configuration for bastion/jump host access."""
    host: str
    port: int = 22
    user: str = ""


class MySQLDatabaseCredentials(BaseModel):
    """Database-level credentials for MySQL."""
    hostname: str
    port: int = 3306
    database: str
    ssl_mode: str = SSLMode.PREFER.value
    ssh: Optional[MySQLSSHConfig] = None


class MySQLAccountCredentials(BaseModel):
    """Account-level credentials (DB user) for MySQL."""
    username: str
    password: str


# ============ Adapter ============

class MySQLAdapter(BaseAdapter):
    """MySQL database adapter."""

    @property
    def database_type(self) -> str:
        return DatabaseType.MYSQL.value

    def validate_database_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str | None]:
        """Validate MySQL database credential structure."""
        if not credentials.get("hostname"):
            return False, "hostname is required"

        port = credentials.get("port", 3306)
        if not isinstance(port, int) or port < 1 or port > 65535:
            return False, "port must be an integer between 1 and 65535"

        if not credentials.get("database"):
            return False, "database is required"

        ssl_mode = credentials.get("ssl_mode", SSLMode.PREFER.value)
        valid_modes = [m.value for m in SSLMode]
        if ssl_mode not in valid_modes:
            return False, f"ssl_mode must be one of: {valid_modes}"

        ssh = credentials.get("ssh")
        if ssh:
            if not ssh.get("host"):
                return False, "ssh.host is required when SSH tunnel is configured"
            ssh_port = ssh.get("port", 22)
            if not isinstance(ssh_port, int) or ssh_port < 1 or ssh_port > 65535:
                return False, "ssh.port must be an integer between 1 and 65535"

        return True, None

    def validate_account_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str | None]:
        """Validate MySQL account credential structure."""
        if not credentials.get("username"):
            return False, "username is required"

        if "password" not in credentials:
            return False, "password is required"

        return True, None
