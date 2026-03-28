-- Drop existing databases if they exist
DROP DATABASE IF EXISTS kitchen_sink;
DROP DATABASE IF EXISTS test;

-- Create databases
-- Note: restaurant and laundromat are demo databases for prod (Neon only)
CREATE DATABASE kitchen_sink;
CREATE DATABASE test;

-- Create users if they don't exist (using environment variables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '${TEST_READ_USER}') THEN
        CREATE USER ${TEST_READ_USER} WITH PASSWORD '${TEST_READ_PASS}';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '${TEST_ADMIN_USER}') THEN
        CREATE USER ${TEST_ADMIN_USER} WITH PASSWORD '${TEST_ADMIN_PASS}';
    END IF;
END
$$;

-- Grant database privileges
GRANT CONNECT ON DATABASE kitchen_sink TO ${TEST_READ_USER};
GRANT CONNECT ON DATABASE test TO ${TEST_READ_USER};

GRANT ALL PRIVILEGES ON DATABASE kitchen_sink TO ${TEST_ADMIN_USER};
GRANT ALL PRIVILEGES ON DATABASE test TO ${TEST_ADMIN_USER};
