#!/bin/bash
set -e

echo "Initializing PostgreSQL databases..."

# Substitute environment variables in the SQL template using sed
# This works even if envsubst is not available
echo "Creating databases and users..."
sed -e "s/\${TEST_READ_USER}/${TEST_READ_USER}/g" \
    -e "s/\${TEST_READ_PASS}/${TEST_READ_PASS}/g" \
    -e "s/\${TEST_ADMIN_USER}/${TEST_ADMIN_USER}/g" \
    -e "s/\${TEST_ADMIN_PASS}/${TEST_ADMIN_PASS}/g" \
    /tmp/init.sql.template | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

# Populate kitchen_sink database (main development/testing database)
echo "Populating kitchen_sink database..."
sed -e "s/\${TEST_READ_USER}/${TEST_READ_USER}/g" \
    -e "s/\${TEST_READ_PASS}/${TEST_READ_PASS}/g" \
    -e "s/\${TEST_ADMIN_USER}/${TEST_ADMIN_USER}/g" \
    -e "s/\${TEST_ADMIN_PASS}/${TEST_ADMIN_PASS}/g" \
    /tmp/kitchen_sink.sql.template | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kitchen_sink"

# Note: restaurant and laundromat databases are demo-only databases
# loaded to Neon for production. Use 'task utils:neon' to load them.

echo "PostgreSQL initialization complete!"
