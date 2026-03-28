from abc import ABC, abstractmethod
from typing import Any

import httpx
from django.conf import settings
from pydantic import BaseModel


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    details: dict[str, Any] | None = None


def test_connection_via_query_service(
    database_type: str,
    database_credentials: dict[str, Any],
    account_credentials: dict[str, Any],
) -> ConnectionTestResult:
    """
    Delegate connection testing to the Go query service.
    
    This ensures parity between connection testing and actual query execution,
    since both use the same Go driver code.
    
    Args:
        database_type: Database type (e.g., "postgres")
        database_credentials: Database connection details (host, port, database, etc.)
        account_credentials: User credentials (username, password)
    
    Returns:
        ConnectionTestResult with success status and message
    """
    query_service_url = getattr(settings, 'QUERY_SERVICE_URL', 'http://localhost:9000')
    query_service_secret = getattr(settings, 'QUERY_SERVICE_SECRET', '')
    
    if not query_service_secret:
        return ConnectionTestResult(
            success=False,
            message="Query service not configured (QUERY_SERVICE_SECRET missing)",
        )
    
    url = f"{query_service_url.rstrip('/')}/api/test-connection"
    
    try:
        response = httpx.post(
            url,
            json={
                "database_type": database_type,
                "database_credentials": database_credentials,
                "account_credentials": account_credentials,
            },
            headers={
                "X-Query-Secret": query_service_secret,
                "Content-Type": "application/json",
            },
            timeout=15.0,  # Connection test timeout
        )
        
        if response.status_code == 403:
            return ConnectionTestResult(
                success=False,
                message="Query service authentication failed",
            )
        
        data = response.json()
        
        return ConnectionTestResult(
            success=data.get("success", False),
            message=data.get("message", "Unknown response"),
            details=data.get("details"),
        )
        
    except httpx.ConnectError:
        return ConnectionTestResult(
            success=False,
            message="Query service unavailable - cannot test connection",
        )
    except httpx.TimeoutException:
        return ConnectionTestResult(
            success=False,
            message="Connection test timed out",
        )
    except Exception as e:
        return ConnectionTestResult(
            success=False,
            message=f"Connection test error: {str(e)}",
        )


class BaseAdapter(ABC):
    """
    Base class for database adapters.
    
    Each adapter handles:
    - Database credential validation
    - Account credential validation
    - Building connection strings/configs
    
    Note: Connection testing and query execution are now handled by the Go query service.
    """
    
    @property
    @abstractmethod
    def database_type(self) -> str:
        """Return the DatabaseType value this adapter handles."""
        pass
    
    @abstractmethod
    def validate_database_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str | None]:
        """
        Validate database credential structure (not connectivity).

        Returns:
            (is_valid, error_message) - error_message is None if valid
        """
        pass
    
    @abstractmethod
    def validate_account_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str | None]:
        """
        Validate account credential structure (not connectivity).

        Returns:
            (is_valid, error_message) - error_message is None if valid
        """
        pass
