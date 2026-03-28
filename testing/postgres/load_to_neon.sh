#!/bin/bash
set -e

# Load environment variables from env.txt
if [ ! -f "env.txt" ]; then
    echo "Error: env.txt not found in current directory"
    exit 1
fi

# Source environment variables properly handling quoted values
set -a
source env.txt
set +a

if [ -z "$NEON_DEMO_CONNECTION_STRING" ]; then
    echo "Error: NEON_DEMO_CONNECTION_STRING not found in env.txt"
    exit 1
fi

if [ -z "$TEST_READ_USER" ] || [ -z "$TEST_ADMIN_USER" ]; then
    echo "Error: TEST_READ_USER or TEST_ADMIN_USER not found in env.txt"
    exit 1
fi

echo "Loading demo databases to Neon..."
echo ""

# Function to load SQL file to a specific database
load_to_database() {
    local db_name=$1
    local sql_file=$2

    echo "Loading $db_name database..."

    # Replace the database name in the connection string with /{db_name}.
    # Neon connection strings can vary (e.g. ending in /neondb or /DBNAME), so instead of
    # matching a specific db name, replace whatever is after the last "/" (before "?").
    local base="${NEON_DEMO_CONNECTION_STRING%%\?*}"
    local query=""
    if [[ "$NEON_DEMO_CONNECTION_STRING" == *"?"* ]]; then
        query="?${NEON_DEMO_CONNECTION_STRING#*\?}"
    fi
    local conn_string="${base%/*}/$db_name${query}"
    echo "  Using connection: $(echo "$conn_string" | sed 's|:[^:@]*@|:***@|')"  # Hide password in output

    # Process SQL file:
    # 1. Substitute environment variables
    # 2. Remove GRANT statements (Neon manages permissions differently)
    sed -e "s/\${TEST_READ_USER}/${TEST_READ_USER}/g" \
        -e "s/\${TEST_READ_PASS}/${TEST_READ_PASS}/g" \
        -e "s/\${TEST_ADMIN_USER}/${TEST_ADMIN_USER}/g" \
        -e "s/\${TEST_ADMIN_PASS}/${TEST_ADMIN_PASS}/g" \
        "$sql_file" | \
    grep -v "^GRANT " | \
    psql "$conn_string" -v ON_ERROR_STOP=1

    echo "✓ $db_name loaded successfully"
    echo ""
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load each database
load_to_database "restaurant" "$SCRIPT_DIR/restaurant.sql"
load_to_database "laundromat" "$SCRIPT_DIR/laundromat.sql"

echo "All databases loaded to Neon successfully!"
echo ""
echo "Connection strings:"
echo "  restaurant:    $(echo "$NEON_DEMO_CONNECTION_STRING" | sed 's|\.tech/neondb|.tech/restaurant|')"
echo "  laundromat:    $(echo "$NEON_DEMO_CONNECTION_STRING" | sed 's|\.tech/neondb|.tech/laundromat|')"
