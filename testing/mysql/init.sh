#!/bin/bash
set -e

echo "Initializing MySQL databases..."

# Substitute environment variables in the SQL template using sed
# This works even if envsubst is not available
echo "Creating databases and users..."
sed -e "s/\${TEST_READ_USER}/${TEST_READ_USER}/g" \
    -e "s/\${TEST_READ_PASS}/${TEST_READ_PASS}/g" \
    -e "s/\${TEST_ADMIN_USER}/${TEST_ADMIN_USER}/g" \
    -e "s/\${TEST_ADMIN_PASS}/${TEST_ADMIN_PASS}/g" \
    /tmp/init.sql.template | mysql --user=root --password="$MYSQL_ROOT_PASSWORD"

# Populate kitchen_sink database
echo "Populating kitchen_sink database..."
sed -e "s/\${TEST_READ_USER}/${TEST_READ_USER}/g" \
    -e "s/\${TEST_READ_PASS}/${TEST_READ_PASS}/g" \
    -e "s/\${TEST_ADMIN_USER}/${TEST_ADMIN_USER}/g" \
    -e "s/\${TEST_ADMIN_PASS}/${TEST_ADMIN_PASS}/g" \
    /tmp/kitchen_sink.sql.template | mysql --user=root --password="$MYSQL_ROOT_PASSWORD"

echo "MySQL initialization complete!"
