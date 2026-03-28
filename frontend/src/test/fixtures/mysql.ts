/**
 * MySQL test fixtures
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
 *   Port: 3307 (Docker) or 3306 (local)
 *   Database: mysql_demo
 *   User: mysql_demo
 *   Password: mysql_demo_pass
 *
 * To use Docker demo databases:
 *   cd fixtures && docker compose up -d
 *   export TEST_MYSQL_PORT=3307
 */

export const MYSQL_TEST_CONFIG = {
  host: process.env.TEST_MYSQL_HOST || 'localhost',
  port: parseInt(process.env.TEST_MYSQL_PORT || '3306'),
  database: process.env.TEST_MYSQL_DB_NAME || process.env.TEST_MYSQL_DATABASE || 'mysql_demo',
  user: process.env.TEST_ADMIN_USER || process.env.TEST_MYSQL_USER || 'mysql_demo',
  password: process.env.TEST_ADMIN_PASS || process.env.TEST_MYSQL_PASSWORD || 'mysql_demo_pass',
}

/**
 * Idempotent setup script for MySQL test fixtures.
 * Creates a 'test_schema' database with sample tables for testing adapters.
 */
export const MYSQL_SETUP_SQL = `
-- ============================================================
-- MySQL Test Fixtures
-- ============================================================
-- Idempotent setup script for database adapter regression tests.
-- Safe to run multiple times - uses IF NOT EXISTS and DROP/CREATE.
-- ============================================================

-- Create test database (schema equivalent in MySQL)
CREATE DATABASE IF NOT EXISTS test_schema;

-- Switch to test database
USE test_schema;

-- Drop existing objects (clean state on re-run)
DROP VIEW IF EXISTS active_products_view;
DROP FUNCTION IF EXISTS get_user_total_orders;
DROP PROCEDURE IF EXISTS update_product_quantity;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Table: users
-- Tests: Primary keys, various text types, timestamps, nullable columns
-- ============================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    display_name TEXT,
    bio TEXT,
    age INT,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL
) COMMENT='Test users table';

-- ============================================================
-- Table: categories
-- Tests: Self-referential foreign key, simple hierarchy
-- ============================================================
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    parent_id INT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ============================================================
-- Table: products
-- Tests: Foreign keys, numeric types, CHECK constraints
-- ============================================================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    category_id INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CHECK (price >= 0),
    CHECK (quantity >= 0),
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);

-- ============================================================
-- Table: orders
-- Tests: Composite foreign keys, CASCADE behavior
-- ============================================================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (total_amount >= 0)
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ============================================================
-- Table: order_items
-- Tests: Composite primary key, multiple foreign keys
-- ============================================================
CREATE TABLE order_items (
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CHECK (quantity > 0),
    CHECK (unit_price >= 0)
);

-- ============================================================
-- Sample Data
-- ============================================================

-- Users
INSERT INTO users (email, username, display_name, age, balance, is_active, metadata) VALUES
('alice@example.com', 'alice', 'Alice Smith', 30, 100.50, true, '{"role": "admin", "verified": true}'),
('bob@example.com', 'bob', 'Bob Jones', 25, 50.00, true, '{"role": "user", "verified": false}'),
('charlie@example.com', 'charlie', NULL, NULL, 0.00, false, NULL);

-- Categories
INSERT INTO categories (name, slug, parent_id) VALUES
('Electronics', 'electronics', NULL),
('Computers', 'computers', 1),
('Laptops', 'laptops', 2),
('Desktops', 'desktops', 2);

-- Products
INSERT INTO products (name, sku, category_id, price, quantity, is_available) VALUES
('Dell XPS 13', 'DELL-XPS-13', 3, 999.99, 10, true),
('MacBook Pro', 'MBP-2023', 3, 1999.99, 5, true),
('Desktop Workstation', 'WS-PRO', 4, 1499.99, 3, true);

-- Orders
INSERT INTO orders (user_id, order_number, status, total_amount) VALUES
(1, 'ORD-001', 'completed', 999.99),
(2, 'ORD-002', 'pending', 1999.99);

-- Order Items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 999.99),
(2, 2, 1, 1999.99);

-- ============================================================
-- Views, Functions, and Procedures
-- ============================================================

-- View: Active products with category info
CREATE VIEW active_products_view AS
SELECT 
    p.id,
    p.name,
    p.price,
    p.quantity,
    c.name as category_name
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.is_available = true;

-- Function: Get total order value for a user
CREATE FUNCTION get_user_total_orders(user_id_param INT)
RETURNS DECIMAL(10, 2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE total DECIMAL(10, 2);
    SELECT COALESCE(SUM(total_amount), 0) INTO total
    FROM orders
    WHERE user_id = user_id_param;
    RETURN total;
END;

-- Procedure: Update product quantity
CREATE PROCEDURE update_product_quantity(
    IN product_id_param INT,
    IN quantity_delta INT
)
BEGIN
    UPDATE products
    SET quantity = quantity + quantity_delta
    WHERE id = product_id_param;
END;
`
