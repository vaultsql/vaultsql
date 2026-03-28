from connection.adapters.base import BaseAdapter, test_connection_via_query_service
from connection.adapters.mysql import MySQLAdapter
from connection.adapters.postgres import PostgresAdapter
from connection.models import DatabaseType


ADAPTER_REGISTRY: dict[str, type[BaseAdapter]] = {
    DatabaseType.POSTGRES.value: PostgresAdapter,
    DatabaseType.MYSQL.value: MySQLAdapter,
}


def get_adapter(database_type: str) -> BaseAdapter:
    """Get an adapter instance for the given database type."""
    adapter_cls = ADAPTER_REGISTRY.get(database_type)
    if not adapter_cls:
        raise ValueError(f"No adapter registered for database type: {database_type}")
    return adapter_cls()
