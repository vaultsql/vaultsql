-- Los Pollos Hermanos (Demo Database)
-- A fast food chain with excellent chicken… and extremely neat paperwork.
--
-- Goals:
-- - idempotent: can be re-run safely
-- - fun: lots of recognizable references for screenshots/videos
-- - realistic-ish: inventory, suppliers, inspections, and a couple useful views

BEGIN;

-- ============================================================================
-- CLEANUP (idempotent)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_restaurant_sales_30d CASCADE;

DROP VIEW IF EXISTS vw_restaurant_inventory_low CASCADE;
DROP VIEW IF EXISTS vw_restaurant_daily_sales CASCADE;

DROP TABLE IF EXISTS security_incidents CASCADE;
DROP TABLE IF EXISTS health_inspections CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS inventory_receipts CASCADE;
DROP TABLE IF EXISTS location_inventory CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS locations CASCADE;

DROP TYPE IF EXISTS restaurant_order_status CASCADE;
DROP TYPE IF EXISTS restaurant_payment_method CASCADE;
DROP TYPE IF EXISTS restaurant_employee_role CASCADE;
DROP TYPE IF EXISTS restaurant_inspection_grade CASCADE;

-- ============================================================================
-- TYPES
-- ============================================================================

CREATE TYPE restaurant_order_status AS ENUM ('completed', 'refunded', 'voided');
CREATE TYPE restaurant_payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'gift_card');
CREATE TYPE restaurant_employee_role AS ENUM ('manager', 'assistant_manager', 'cashier', 'cook', 'shift_lead', 'security');
CREATE TYPE restaurant_inspection_grade AS ENUM ('A', 'B', 'C', 'pending');

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  phone VARCHAR(20),
  opened_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'renovation')),
  notes TEXT
);

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  role restaurant_employee_role NOT NULL,
  hire_date DATE NOT NULL,
  hourly_rate DECIMAL(6, 2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  phone VARCHAR(20),
  email VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  employee_code VARCHAR(20) UNIQUE,
  notes TEXT
);

CREATE UNIQUE INDEX employees_email_unique
  ON employees (email)
  WHERE email IS NOT NULL;

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  loyalty_points INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  favorite_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX customers_email_unique
  ON customers (email)
  WHERE email IS NOT NULL;

CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  price DECIMAL(8, 2) NOT NULL CHECK (price >= 0),
  calories INTEGER CHECK (calories IS NULL OR calories >= 0),
  spice_level INTEGER NOT NULL DEFAULT 0 CHECK (spice_level BETWEEN 0 AND 5),
  available BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX menu_items_category_idx ON menu_items (category);
CREATE INDEX menu_items_available_idx ON menu_items (available);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method restaurant_payment_method,
  status restaurant_order_status NOT NULL DEFAULT 'completed',
  notes TEXT
);

CREATE INDEX orders_date_idx ON orders (order_date DESC);
CREATE INDEX orders_location_date_idx ON orders (location_id, order_date DESC);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(8, 2) NOT NULL CHECK (unit_price >= 0),
  special_instructions TEXT
);

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  supplier_name VARCHAR(120) NOT NULL UNIQUE,
  contact_name VARCHAR(120),
  phone VARCHAR(20),
  email VARCHAR(100),
  category VARCHAR(50) NOT NULL,
  notes TEXT
);

CREATE TABLE inventory_items (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(30) NOT NULL UNIQUE,
  item_name VARCHAR(120) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'each',
  par_level INTEGER NOT NULL DEFAULT 0 CHECK (par_level >= 0),
  notes TEXT
);

CREATE TABLE location_inventory (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  last_counted_at TIMESTAMP,
  CONSTRAINT location_inventory_unique UNIQUE (location_id, inventory_item_id)
);

CREATE INDEX location_inventory_low_idx
  ON location_inventory (location_id, on_hand);

CREATE TABLE inventory_receipts (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  received_date DATE NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  received_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  CONSTRAINT inventory_receipts_invoice_unique UNIQUE (supplier_id, invoice_number, inventory_item_id)
);

-- Simple recipe mapping to make inventory feel "real"
CREATE TABLE recipe_ingredients (
  id SERIAL PRIMARY KEY,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  CONSTRAINT recipe_ingredients_unique UNIQUE (menu_item_id, inventory_item_id)
);

CREATE TABLE health_inspections (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL,
  grade restaurant_inspection_grade NOT NULL DEFAULT 'pending',
  inspector_name VARCHAR(120),
  notes TEXT,
  CONSTRAINT health_inspections_unique UNIQUE (location_id, inspection_date)
);

CREATE TABLE security_incidents (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  incident_at TIMESTAMP NOT NULL,
  severity INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  reported_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  summary VARCHAR(200) NOT NULL,
  details TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX security_incidents_incident_at_idx ON security_incidents (incident_at DESC);

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO locations (id, name, address, city, state, phone, opened_date, status, notes) VALUES
  (1, 'Los Pollos Hermanos - Albuquerque Central', '12000 Coors Rd SW', 'Albuquerque', 'NM', '505-555-0001', '2002-03-15', 'active', 'Flagship location. Immaculate dining room.'),
  (2, 'Los Pollos Hermanos - South Valley', '4257 Isleta Blvd SW', 'Albuquerque', 'NM', '505-555-0002', '2005-07-20', 'active', 'Drive-thru is always busy.'),
  (3, 'Los Pollos Hermanos - Santa Fe', '2500 Cerrillos Rd', 'Santa Fe', 'NM', '505-555-0003', '2008-11-10', 'active', 'Tourists love the combo meals.'),
  (4, 'Los Pollos Hermanos - Las Cruces', '1200 El Paseo Rd', 'Las Cruces', 'NM', '575-555-0004', '2010-05-01', 'active', 'Training store for new managers.');

INSERT INTO employees (id, location_id, first_name, last_name, role, hire_date, hourly_rate, phone, email, status, employee_code, notes) VALUES
  (1, 1, 'Gustavo', 'Fring', 'manager', '2002-03-15', 45.00, '505-555-1001', 'gus@lospolloshermanos.com', 'active', 'LPH-ABQ-0001', 'Cares deeply about quality and cleanliness.'),
  (2, 1, 'Lyle', 'Brown', 'assistant_manager', '2003-06-01', 22.50, '505-555-1002', 'lyle@lospolloshermanos.com', 'active', 'LPH-ABQ-0002', '“Acceptable” is not acceptable.'),
  (3, 1, 'Maria', 'Garcia', 'cashier', '2015-02-10', 15.00, '505-555-1003', 'maria.g@lospolloshermanos.com', 'active', 'LPH-ABQ-0103', NULL),
  (4, 1, 'Juan', 'Rodriguez', 'cook', '2014-08-15', 17.50, '505-555-1004', 'juan.r@lospolloshermanos.com', 'active', 'LPH-ABQ-0104', 'Never overcooks the chicken.'),
  (5, 1, 'Angela', 'Chen', 'cashier', '2016-11-20', 15.00, '505-555-1005', 'angela.c@lospolloshermanos.com', 'active', 'LPH-ABQ-0105', NULL),
  (6, 2, 'Mike', 'Ehrmantraut', 'manager', '2010-01-15', 28.00, '505-555-2001', 'mike@lospolloshermanos.com', 'active', 'LPH-SV-0201', 'Keeps things calm.'),
  (7, 2, 'Carmen', 'Molina', 'cook', '2011-03-20', 17.00, '505-555-2002', 'carmen.m@lospolloshermanos.com', 'active', 'LPH-SV-0202', NULL),
  (8, 2, 'David', 'Martinez', 'cashier', '2012-09-05', 14.50, '505-555-2003', 'david.m@lospolloshermanos.com', 'active', 'LPH-SV-0203', NULL),
  (9, 3, 'Cynthia', 'Anderson', 'manager', '2008-11-10', 26.00, '505-555-3001', 'cynthia@lospolloshermanos.com', 'active', 'LPH-SF-0301', 'Runs a tight ship.'),
  (10, 3, 'Robert', 'Kim', 'cook', '2009-04-12', 16.50, '505-555-3002', 'robert.k@lospolloshermanos.com', 'active', 'LPH-SF-0302', NULL),
  (11, 1, 'Tyrus', 'Kitt', 'security', '2009-07-01', 30.00, '505-555-9090', NULL, 'active', 'LPH-SEC-0007', 'Rarely smiles.'),
  (12, 1, 'Victor', 'St. Clair', 'security', '2009-06-15', 30.00, '505-555-8080', NULL, 'inactive', 'LPH-SEC-0006', 'No longer with the company.');

INSERT INTO customers (id, full_name, phone, email, loyalty_points, favorite_location_id, notes) VALUES
  (1, 'Walter White', '505-555-0001', 'walter.white@gmail.com', 120, 1, 'Always orders on schedule.'),
  (2, 'Jesse Pinkman', '505-555-0002', 'capncook@proton.me', 45, 1, 'Likes the spicy sandwich.'),
  (3, 'Saul Goodman', '505-555-0147', 'saul@bettercallsaul.com', 300, 2, 'Asks about gift cards… a lot.'),
  (4, 'Hank Schrader', '505-555-0201', 'hank.s@gmail.com', 10, 1, 'Talks loud. Tips well.'),
  (5, 'Marie Schrader', '505-555-0202', 'marie.s@gmail.com', 20, 1, 'Prefers “no onions”.'),
  (6, 'Lydia Rodarte-Quayle', '505-555-0051', 'lydia@madrigal.com', 5, 3, 'Neat handwriting.'),
  (7, 'Gale Boetticher', '505-555-0444', 'gale.b@unm.edu', 80, 3, 'Writes long feedback emails.'),
  (8, 'Steven Gomez', '505-555-0203', 'gomez.s@gmail.com', 15, 2, NULL),
  (9, 'Bogdan Wolynetz', '505-555-0004', 'bogdan@a1acarwash.com', 2, 1, 'Doesn’t like the new owner.'),
  (10, 'Kim Wexler', '505-555-0111', 'kim.w@hhm.com', 60, 2, 'Quick lunch. Always.');

INSERT INTO menu_items (id, name, category, description, price, calories, spice_level, available) VALUES
  -- Chicken
  (1, '1 Piece Chicken', 'Chicken', 'Crispy fried chicken breast or thigh', 3.49, 320, 0, true),
  (2, '2 Piece Chicken', 'Chicken', 'Two pieces of crispy fried chicken', 6.49, 640, 0, true),
  (3, '3 Piece Chicken', 'Chicken', 'Three pieces of crispy fried chicken', 8.99, 960, 0, true),
  (4, '12 Piece Bucket', 'Chicken', 'Family size bucket with 12 pieces', 24.99, 3840, 0, true),
  (5, 'Chicken Sandwich', 'Sandwiches', 'Crispy chicken breast on a toasted bun', 5.99, 520, 1, true),
  (6, 'Spicy Chicken Sandwich', 'Sandwiches', 'Spicy crispy chicken with pepper sauce', 6.49, 580, 4, true),
  (7, '“Blue Sky” Slush', 'Drinks', 'A bright-blue citrus slush (limited time)', 2.99, 220, 0, true),
  -- Sides
  (8, 'French Fries', 'Sides', 'Crispy golden fries', 2.49, 340, 0, true),
  (9, 'Coleslaw', 'Sides', 'Creamy cabbage slaw', 2.29, 170, 0, true),
  (10, 'Mashed Potatoes', 'Sides', 'Mashed potatoes with gravy', 2.99, 210, 0, true),
  (11, 'Biscuit', 'Sides', 'Warm, buttery biscuit', 1.49, 180, 0, true),
  -- Drinks
  (12, 'Small Soda', 'Drinks', 'Small soft drink', 1.99, 150, 0, true),
  (13, 'Iced Tea', 'Drinks', 'Sweet or unsweet iced tea', 2.29, 90, 0, true),
  (14, 'Coffee', 'Drinks', 'Fresh brewed coffee', 1.99, 5, 0, true),
  -- Secret-ish menu (still orderable)
  (15, 'The “Signature Box”', 'Combos', 'Chicken + sides + drink. Very… consistent.', 12.49, 980, 1, true);

INSERT INTO suppliers (id, supplier_name, contact_name, phone, email, category, notes) VALUES
  (1, 'Madrigal Electromotive (Food Logistics)', 'Lydia R-Q', '505-555-3131', 'logistics@madrigal.com', 'distribution', 'Always on time. Always documented.'),
  (2, 'Albuquerque Poultry Co.', 'Eddie', '505-555-2222', 'sales@abqpoultry.co', 'protein', 'Delivers refrigerated chicken.'),
  (3, 'New Mexico Produce Market', 'Rosa', '505-555-3333', 'orders@nmproduce.co', 'produce', 'Fresh daily produce.'),
  (4, 'Hermano Beverage Supply', 'Carl', '505-555-4444', 'sales@hermanobev.co', 'beverage', 'Soda syrup and cups.');

INSERT INTO inventory_items (id, sku, item_name, unit, par_level, notes) VALUES
  (1, 'CHK-BREAST', 'Chicken Breast (raw)', 'lb', 200, 'Keep at safe temp.'),
  (2, 'CHK-THIGH', 'Chicken Thigh (raw)', 'lb', 200, NULL),
  (3, 'BUN-001', 'Sandwich Bun', 'each', 300, NULL),
  (4, 'SLW-MIX', 'Coleslaw Mix', 'bag', 40, NULL),
  (5, 'POT-001', 'Potatoes', 'lb', 150, NULL),
  (6, 'GRV-001', 'Gravy Base', 'bag', 30, NULL),
  (7, 'SODA-CUP-S', 'Cup (Small)', 'each', 400, NULL),
  (8, 'SODA-CUP-L', 'Cup (Large)', 'each', 300, NULL),
  (9, 'TEA-BAG', 'Tea Bags', 'box', 20, NULL),
  (10, 'ICE-001', 'Ice (bagged)', 'bag', 60, 'For the slush.'),
  (11, 'SYR-BLUE', 'Blue Citrus Syrup', 'bottle', 25, 'Limited time promo ingredient.');

INSERT INTO location_inventory (location_id, inventory_item_id, on_hand, last_counted_at) VALUES
  (1, 1, 180, '2024-12-07 08:00:00'),
  (1, 3, 260, '2024-12-07 08:00:00'),
  (1, 11, 4, '2024-12-07 08:00:00'),
  (2, 1, 140, '2024-12-07 08:30:00'),
  (2, 3, 200, '2024-12-07 08:30:00'),
  (3, 1, 90, '2024-12-07 09:00:00'),
  (3, 11, 2, '2024-12-07 09:00:00'),
  (4, 1, 120, '2024-12-07 09:15:00');

INSERT INTO inventory_receipts (location_id, supplier_id, received_date, invoice_number, inventory_item_id, quantity, unit_cost, received_by_employee_id, notes) VALUES
  (1, 2, '2024-12-05', 'ABQ-POULTRY-1205', 1, 120, 2.15, 2, NULL),
  (1, 1, '2024-12-06', 'MADRIGAL-1206-A', 11, 12, 8.50, 1, 'Counted twice. Still 12.'),
  (3, 1, '2024-12-06', 'MADRIGAL-1206-B', 11, 8, 8.50, 9, 'Signed at 06:05 sharp.');

INSERT INTO recipe_ingredients (menu_item_id, inventory_item_id, qty) VALUES
  (5, 1, 1),  -- chicken sandwich uses breast
  (5, 3, 1),  -- bun
  (6, 1, 1),  -- spicy sandwich uses breast
  (6, 3, 1),
  (9, 4, 1),  -- coleslaw
  (10, 5, 1), -- mashed potatoes
  (10, 6, 1),
  (7, 10, 1), -- slush: ice
  (7, 11, 1); -- slush: syrup

INSERT INTO health_inspections (location_id, inspection_date, grade, inspector_name, notes) VALUES
  (1, '2024-11-15', 'A', 'Inspector Trujillo', 'Kitchen immaculate. Logs immaculate.'),
  (2, '2024-11-20', 'A', 'Inspector Trujillo', 'Everything in order.'),
  (3, '2024-11-22', 'A', 'Inspector Trujillo', 'Promotional syrup stored properly.'),
  (4, '2024-11-28', 'B', 'Inspector Trujillo', 'Minor signage issue. Corrected on-site.');

INSERT INTO orders (id, location_id, employee_id, customer_id, order_date, total_amount, payment_method, status, notes) VALUES
  (1, 1, 3, 1, '2024-12-08 12:15:00', 15.47, 'credit_card', 'completed', NULL),
  (2, 1, 5, 2, '2024-12-08 12:30:00', 8.98, 'cash', 'completed', NULL),
  (3, 1, 3, 1, '2024-12-08 13:00:00', 27.48, 'credit_card', 'completed', '“Family meal”'),
  (4, 1, 5, 4, '2024-12-09 11:45:00', 12.47, 'cash', 'completed', NULL),
  (5, 1, 3, 5, '2024-12-09 12:20:00', 18.96, 'debit_card', 'completed', 'No onions'),
  (6, 2, 8, 3, '2024-12-09 13:15:00', 24.99, 'credit_card', 'completed', 'Gift card inquiry'),
  (7, 1, 5, NULL, '2024-12-10 12:00:00', 31.45, 'cash', 'completed', 'Teenager paid in exact change'),
  (8, 2, 8, 8, '2024-12-10 12:30:00', 14.96, 'credit_card', 'completed', NULL),
  (9, 3, 10, 6, '2024-12-11 11:30:00', 19.95, 'cash', 'completed', 'Asked for extra napkins'),
  (10, 1, 3, 9, '2024-12-11 13:00:00', 45.92, 'credit_card', 'completed', 'Customer unhappy with air freshener');

INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, special_instructions) VALUES
  -- Order 1
  (1, 3, 1, 8.99, NULL),
  (1, 8, 1, 2.49, NULL),
  (1, 13, 1, 2.29, 'No ice'),
  (1, 7, 1, 2.99, 'Extra blue'),
  -- Order 2
  (2, 5, 1, 5.99, NULL),
  (2, 12, 1, 1.99, NULL),
  -- Order 3
  (3, 4, 1, 24.99, NULL),
  (3, 10, 1, 2.99, NULL),
  -- Order 4
  (4, 2, 1, 6.49, NULL),
  (4, 9, 1, 2.29, NULL),
  (4, 12, 1, 1.99, NULL),
  -- Order 5
  (5, 6, 2, 6.49, 'Extra spicy'),
  (5, 8, 2, 2.49, NULL),
  -- Order 6
  (6, 4, 1, 24.99, NULL),
  -- Order 7
  (7, 1, 4, 3.49, NULL),
  (7, 8, 3, 2.49, NULL),
  (7, 10, 2, 2.99, NULL),
  (7, 13, 2, 2.29, NULL),
  -- Order 8
  (8, 5, 2, 5.99, NULL),
  (8, 10, 2, 2.99, NULL),
  -- Order 9
  (9, 3, 2, 8.99, NULL),
  (9, 14, 1, 1.99, NULL),
  -- Order 10
  (10, 4, 1, 24.99, NULL),
  (10, 2, 2, 6.49, NULL),
  (10, 8, 2, 2.49, NULL),
  (10, 7, 2, 2.99, 'No ice');

INSERT INTO security_incidents (location_id, incident_at, severity, reported_by_employee_id, summary, details, resolved) VALUES
  (1, '2024-12-06 22:10:00', 2, 11, 'After-hours delivery', 'Delivery arrived exactly on time, signed without issues.', true),
  (1, '2024-12-10 21:55:00', 3, 2, 'Customer complaint escalated', 'Customer insisted on speaking to manager; de-escalated quickly.', true),
  (2, '2024-12-12 19:20:00', 1, 6, 'Parking lot noise', 'Kids racing carts. No damage.', true);

-- ============================================================================
-- VIEWS (screenshot-friendly)
-- ============================================================================

CREATE VIEW vw_restaurant_daily_sales AS
SELECT
  date_trunc('day', o.order_date) AS day,
  l.name AS location,
  COUNT(*) AS order_count,
  SUM(o.total_amount) AS gross_sales
FROM orders o
JOIN locations l ON l.id = o.location_id
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE VIEW vw_restaurant_inventory_low AS
SELECT
  l.name AS location,
  ii.sku,
  ii.item_name,
  li.on_hand,
  ii.par_level,
  (ii.par_level - li.on_hand) AS short_by,
  li.last_counted_at
FROM location_inventory li
JOIN locations l ON l.id = li.location_id
JOIN inventory_items ii ON ii.id = li.inventory_item_id
WHERE li.on_hand < ii.par_level
ORDER BY short_by DESC, location, ii.item_name;

CREATE MATERIALIZED VIEW mv_restaurant_sales_30d AS
SELECT
  l.id AS location_id,
  l.name AS location,
  date_trunc('day', o.order_date) AS day,
  SUM(o.total_amount) AS gross_sales
FROM orders o
JOIN locations l ON l.id = o.location_id
WHERE o.order_date >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY 1, 2, 3
ORDER BY 3 DESC, 2;

COMMIT;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO ${TEST_READ_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${TEST_READ_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${TEST_READ_USER};

GRANT ALL PRIVILEGES ON SCHEMA public TO ${TEST_ADMIN_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${TEST_ADMIN_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${TEST_ADMIN_USER};
