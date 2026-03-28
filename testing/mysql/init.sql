-- Drop and recreate databases
DROP DATABASE IF EXISTS kitchen_sink;
DROP DATABASE IF EXISTS test;

CREATE DATABASE kitchen_sink CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create users (using environment variables)
CREATE USER IF NOT EXISTS '${TEST_READ_USER}'@'%' IDENTIFIED BY '${TEST_READ_PASS}';
CREATE USER IF NOT EXISTS '${TEST_ADMIN_USER}'@'%' IDENTIFIED BY '${TEST_ADMIN_PASS}';

-- Grant privileges
GRANT SELECT ON kitchen_sink.* TO '${TEST_READ_USER}'@'%';
GRANT SELECT ON test.* TO '${TEST_READ_USER}'@'%';

GRANT ALL PRIVILEGES ON kitchen_sink.* TO '${TEST_ADMIN_USER}'@'%';
GRANT ALL PRIVILEGES ON test.* TO '${TEST_ADMIN_USER}'@'%';

FLUSH PRIVILEGES;
