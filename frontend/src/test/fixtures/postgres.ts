/**
 * PostgreSQL test fixtures
 *
 * Creates a test schema with sample tables for adapter regression testing.
 * Designed to be idempotent - safe to run multiple times.
 *
 * NOTE: This SQL is intentionally embedded here (not imported from /fixtures/sql/)
 * to allow frontend tests to run independently without backend dependencies.
 * The test schema is separate from the demo database fixtures.
 *
 * Default Connection (uses Docker demo database):
 *   Host: localhost
 *   Port: 5433 (Docker) or 5432 (local)
 *   Database: demodb
 *   User: admin
 *   Password: InsecureDbPass
 *
 * To use Docker demo databases:
 *   docker compose up -d
 *   export TEST_PG_PORT=5433
 *
 * The fixtures create a 'test_schema' within the database that can be
 * dropped and recreated without affecting other data.
 *
 * For a dedicated test database, run as postgres superuser:
 *   psql -U postgres -c "CREATE USER test_user WITH PASSWORD 'test_password';"
 *   psql -U postgres -c "CREATE DATABASE test_db OWNER test_user;"
 *   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE test_db TO test_user;"
 *
 * Then set environment variables:
 *   TEST_PG_DATABASE=test_db TEST_PG_USER=test_user TEST_PG_PASSWORD=test_password
 */

export const POSTGRES_TEST_CONFIG = {
  host: process.env.TEST_PG_HOST || 'localhost',
  port: parseInt(process.env.TEST_PG_PORT || '5432'),
  database: process.env.TEST_PG_DATABASE || 'demodb',
  user: process.env.TEST_PG_USER || 'admin',
  password: process.env.TEST_PG_PASSWORD || 'InsecureDbPass',
}

/**
 * Idempotent setup script for PostgreSQL test fixtures.
 * Creates a 'test_schema' with sample tables for testing adapters.
 */
export const POSTGRES_SETUP_SQL = `
-- ============================================================
-- PostgreSQL Test Fixtures
-- ============================================================
-- Idempotent setup script for database adapter regression tests.
-- Safe to run multiple times - uses IF NOT EXISTS and DROP/CREATE.
-- ============================================================

-- Create test schema
CREATE SCHEMA IF NOT EXISTS test_schema;

-- Drop existing views/tables/functions/procedures (clean state on re-run)
DO $$
DECLARE r RECORD;
BEGIN
    -- Drop materialized views first
    FOR r IN (SELECT matviewname FROM pg_matviews WHERE schemaname = 'test_schema') LOOP
        EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', 'test_schema', r.matviewname);
    END LOOP;

    -- Drop views
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'test_schema') LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', 'test_schema', r.table_name);
    END LOOP;

    -- Drop functions and procedures
    FOR r IN (SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prokind
              FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'test_schema') LOOP
        IF r.prokind = 'p' THEN
            EXECUTE format('DROP PROCEDURE IF EXISTS %I.%I(%s) CASCADE', 'test_schema', r.proname, r.args);
        ELSE
            EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 'test_schema', r.proname, r.args);
        END IF;
    END LOOP;

    -- Drop tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'test_schema') LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 'test_schema', r.tablename);
    END LOOP;
END $$;

-- ============================================================
-- Table: users
-- Tests: Primary keys, various text types, timestamps, nullable columns
-- ============================================================
CREATE TABLE test_schema.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    display_name TEXT,
    bio TEXT,
    age INTEGER,
    balance NUMERIC(10, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    tags TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

COMMENT ON TABLE test_schema.users IS 'Test users table';
COMMENT ON COLUMN test_schema.users.email IS 'User email address';
COMMENT ON COLUMN test_schema.users.metadata IS 'Arbitrary JSON metadata';

-- ============================================================
-- Table: categories
-- Tests: Self-referential foreign key, simple hierarchy
-- ============================================================
CREATE TABLE test_schema.categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES test_schema.categories(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent ON test_schema.categories(parent_id);

-- ============================================================
-- Table: products
-- Tests: Foreign keys, decimal types, enum-like status
-- ============================================================
CREATE TABLE test_schema.products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    cost NUMERIC(10, 2),
    quantity INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER REFERENCES test_schema.categories(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_products_category ON test_schema.products(category_id);
CREATE INDEX idx_products_status ON test_schema.products(status);

-- ============================================================
-- Table: orders
-- Tests: Foreign keys, order/line-item pattern
-- ============================================================
CREATE TABLE test_schema.orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES test_schema.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    shipped_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_orders_user ON test_schema.orders(user_id);
CREATE INDEX idx_orders_status ON test_schema.orders(status);

-- ============================================================
-- Table: order_items
-- Tests: Composite relationships, line items
-- ============================================================
CREATE TABLE test_schema.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES test_schema.orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES test_schema.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON test_schema.order_items(order_id);
CREATE INDEX idx_order_items_product ON test_schema.order_items(product_id);
CREATE UNIQUE INDEX idx_order_items_order_product ON test_schema.order_items(order_id, product_id);

-- ============================================================
-- Seed Data
-- ============================================================

-- Users
INSERT INTO test_schema.users (email, username, display_name, age, is_active, metadata, tags) VALUES
    ('alice@example.com', 'alice', 'Alice Smith', 30, true, '{"role": "admin"}', ARRAY['vip', 'early-adopter']),
    ('bob@example.com', 'bob', 'Bob Jones', 25, true, '{"role": "user"}', ARRAY['user']),
    ('charlie@example.com', 'charlie', NULL, NULL, false, NULL, NULL);

-- Categories
INSERT INTO test_schema.categories (name, slug, parent_id, sort_order) VALUES
    ('Electronics', 'electronics', NULL, 1),
    ('Clothing', 'clothing', NULL, 2),
    ('Phones', 'phones', 1, 1),
    ('Laptops', 'laptops', 1, 2);

-- Products
INSERT INTO test_schema.products (sku, name, description, price, cost, quantity, category_id, status, is_featured) VALUES
    ('PHONE-001', 'Smartphone X', 'Latest smartphone', 999.99, 700.00, 50, 3, 'active', true),
    ('PHONE-002', 'Smartphone Y', 'Budget smartphone', 499.99, 300.00, 100, 3, 'active', false),
    ('LAPTOP-001', 'Pro Laptop', 'Professional laptop', 1999.99, 1500.00, 25, 4, 'active', true),
    ('LAPTOP-002', 'Basic Laptop', NULL, 799.99, 500.00, 0, 4, 'draft', false),
    ('SHIRT-001', 'T-Shirt', 'Cotton t-shirt', 29.99, 10.00, 200, 2, 'active', false);

-- Orders
INSERT INTO test_schema.orders (user_id, status, total_amount, notes) VALUES
    (1, 'delivered', 1999.99, 'Express shipping requested'),
    (1, 'pending', 529.98, NULL),
    (2, 'confirmed', 999.99, 'Gift wrap');

-- Order Items
INSERT INTO test_schema.order_items (order_id, product_id, quantity, unit_price, total_price) VALUES
    (1, 3, 1, 1999.99, 1999.99),
    (2, 5, 2, 29.99, 59.98),
    (2, 2, 1, 499.99, 499.99),
    (3, 1, 1, 999.99, 999.99);

-- ============================================================
-- Views, Functions, Procedures, and Materialized Views
-- ============================================================

-- View: Active products with category info
CREATE VIEW test_schema.active_products_view AS
SELECT 
    p.id,
    p.name,
    p.price,
    p.quantity,
    c.name as category_name
FROM test_schema.products p
JOIN test_schema.categories c ON p.category_id = c.id
WHERE p.status = 'active';

-- Function: Get total order value for a user
CREATE OR REPLACE FUNCTION test_schema.get_user_total_orders(user_id_param INTEGER)
RETURNS NUMERIC AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(total_amount), 0)
        FROM test_schema.orders
        WHERE user_id = user_id_param
    );
END;
$$ LANGUAGE plpgsql;

-- Procedure: Update product quantity
CREATE OR REPLACE PROCEDURE test_schema.update_product_quantity(
    product_id_param INTEGER,
    quantity_delta INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE test_schema.products
    SET quantity = quantity + quantity_delta
    WHERE id = product_id_param;
END;
$$;

-- Materialized View: Product sales summary
CREATE MATERIALIZED VIEW test_schema.product_sales_summary AS
SELECT 
    p.id,
    p.name,
    p.sku,
    COUNT(oi.id) as times_ordered,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.total_price) as total_revenue
FROM test_schema.products p
LEFT JOIN test_schema.order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name, p.sku;

-- ============================================================
-- Verify setup
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE 'Test fixtures created successfully';
    RAISE NOTICE 'Schema: test_schema';
    RAISE NOTICE 'Tables: users, categories, products, orders, order_items';
    RAISE NOTICE 'Views: active_products_view';
    RAISE NOTICE 'Functions: get_user_total_orders';
    RAISE NOTICE 'Procedures: update_product_quantity';
    RAISE NOTICE 'Materialized Views: product_sales_summary';
END $$;
`

/**
 * Minimal teardown - drops the test schema.
 * Usually not needed since setup is idempotent.
 */
export const POSTGRES_TEARDOWN_SQL = `
DROP SCHEMA IF EXISTS test_schema CASCADE;
`
