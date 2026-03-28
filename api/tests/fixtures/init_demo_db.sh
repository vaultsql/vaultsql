#!/bin/bash
# ============================================================================
# DEPRECATED: This script is deprecated in favor of Docker Compose
# ============================================================================
#
# Please use Docker Compose instead:
#   docker compose up -d
#   ./scripts/docker-dev.sh
#
# See /docs/DOCKER_SETUP.md for details
# ============================================================================

# Initialize the demo database for Los Pollos Hermanos
# This script creates the database and loads the demo schema

set -e

DB_NAME="demodb"
DB_USER_ADMIN="admin"
DB_USER_READONLY="readonly"
DB_PASSWORD="InsecureDbPass"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/demo_db.sql"

echo "🐔 Los Pollos Hermanos Demo Database Setup"
echo "==========================================="
echo ""

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

echo "✓ PostgreSQL is running"

# Drop database if it exists and recreate
echo "📦 Recreating database: $DB_NAME"
# Terminate any active connections to the database
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
psql -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -d postgres -c "CREATE DATABASE $DB_NAME;"

# Create users
echo "👤 Creating database users..."
psql -d "$DB_NAME" -c "DROP USER IF EXISTS $DB_USER_ADMIN;" 2>/dev/null || true
psql -d "$DB_NAME" -c "DROP USER IF EXISTS $DB_USER_READONLY;" 2>/dev/null || true
psql -d "$DB_NAME" -c "CREATE USER $DB_USER_ADMIN WITH PASSWORD '$DB_PASSWORD';"
psql -d "$DB_NAME" -c "CREATE USER $DB_USER_READONLY WITH PASSWORD '$DB_PASSWORD';"

# Load schema and data
echo "📝 Loading schema and sample data..."
psql -d "$DB_NAME" -f "$SQL_FILE" -q

# Grant permissions
echo "🔐 Setting up permissions..."
psql -d "$DB_NAME" <<EOF
-- Admin user: full access
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER_ADMIN;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER_ADMIN;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER_ADMIN;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER_ADMIN;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER_ADMIN;

-- Readonly user: select only
GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER_READONLY;
GRANT USAGE ON SCHEMA public TO $DB_USER_READONLY;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO $DB_USER_READONLY;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO $DB_USER_READONLY;
EOF

echo ""
echo "✅ Demo database initialized successfully!"
echo ""
echo "Database Details:"
echo "  Name:     $DB_NAME"
echo "  Host:     localhost"
echo "  Port:     5432"
echo ""
echo "Users:"
echo "  Admin:    $DB_USER_ADMIN / $DB_PASSWORD"
echo "  Readonly: $DB_USER_READONLY / $DB_PASSWORD"
echo ""
echo "Sample Queries to Try:"
echo "  SELECT * FROM customers LIMIT 5;"
echo "  SELECT * FROM sales_summary;"
echo "  SELECT * FROM top_products;"
echo ""
