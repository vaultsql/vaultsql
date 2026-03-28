-- Lavandería Brillante (Demo Database)
-- A "totally legitimate" industrial laundromat with a few… interesting patterns.
--
-- Goals:
-- - idempotent: can be re-run safely
-- - fun: lots of recognizable references for screenshots/videos
-- - realistic-ish: constraints, indexes, and a couple useful views

BEGIN;

-- ============================================================================
-- CLEANUP (idempotent)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_laundromat_cashflow_7d CASCADE;

DROP VIEW IF EXISTS vw_laundromat_suspicious_activity CASCADE;
DROP VIEW IF EXISTS vw_laundromat_daily_revenue CASCADE;

DROP TABLE IF EXISTS locker_access_log CASCADE;
DROP TABLE IF EXISTS storage_lockers CASCADE;
DROP TABLE IF EXISTS chemical_shipments CASCADE;
DROP TABLE IF EXISTS supply_vendors CASCADE;
DROP TABLE IF EXISTS cash_drawer_counts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS equipment_maintenance CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS special_services CASCADE;

DROP TYPE IF EXISTS laundromat_payment_method CASCADE;
DROP TYPE IF EXISTS laundromat_membership_tier CASCADE;
DROP TYPE IF EXISTS laundromat_equipment_status CASCADE;
DROP TYPE IF EXISTS laundromat_txn_flag CASCADE;

-- ============================================================================
-- TYPES
-- ============================================================================

CREATE TYPE laundromat_membership_tier AS ENUM ('standard', 'silver', 'gold', 'platinum');
CREATE TYPE laundromat_payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'wire_transfer', 'check', 'gift_card');
CREATE TYPE laundromat_equipment_status AS ENUM ('operational', 'maintenance', 'out_of_order', 'retired');
CREATE TYPE laundromat_txn_flag AS ENUM ('none', 'round_number', 'after_hours', 'manual_override', 'structuring', 'vip');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  membership_tier laundromat_membership_tier NOT NULL DEFAULT 'standard',
  credit_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (credit_balance >= 0),
  registered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  referral_code VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX customers_email_unique
  ON customers (email)
  WHERE email IS NOT NULL;

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL,
  hire_date DATE NOT NULL,
  hourly_rate DECIMAL(6, 2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  phone VARCHAR(20),
  email VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  badge_code VARCHAR(32) UNIQUE,
  notes TEXT
);

CREATE UNIQUE INDEX employees_email_unique
  ON employees (email)
  WHERE email IS NOT NULL;

-- Services (normal + suspiciously-coded)
CREATE TABLE special_services (
  id SERIAL PRIMARY KEY,
  service_code VARCHAR(24) UNIQUE NOT NULL,
  service_name VARCHAR(120) NOT NULL,
  base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  category VARCHAR(50) NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT
);

-- Equipment
CREATE TABLE equipment (
  id SERIAL PRIMARY KEY,
  equipment_type VARCHAR(50) NOT NULL,
  machine_number VARCHAR(20) UNIQUE NOT NULL,
  location VARCHAR(50) NOT NULL,
  purchase_date DATE,
  status laundromat_equipment_status NOT NULL DEFAULT 'operational',
  last_service_date DATE,
  notes TEXT
);

CREATE INDEX equipment_location_idx ON equipment (location);
CREATE INDEX equipment_status_idx ON equipment (status);

CREATE TABLE equipment_maintenance (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL,
  technician_name VARCHAR(100) NOT NULL,
  work_performed TEXT NOT NULL,
  parts_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (parts_cost >= 0),
  labor_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (labor_cost >= 0),
  next_service_date DATE,
  priority VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX equipment_maintenance_equipment_date_idx
  ON equipment_maintenance (equipment_id, maintenance_date DESC);

-- Transactions
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  service_id INTEGER REFERENCES special_services(id) ON DELETE SET NULL,
  transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  payment_method laundromat_payment_method,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  discount_applied DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_applied >= 0),
  processed_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  flag laundromat_txn_flag NOT NULL DEFAULT 'none'
);

CREATE INDEX transactions_date_idx ON transactions (transaction_date DESC);
CREATE INDEX transactions_customer_idx ON transactions (customer_id);
CREATE INDEX transactions_flag_idx ON transactions (flag);

-- A simple cash drawer reconciliation log (for "why is the drawer always off by $0.01?")
CREATE TABLE cash_drawer_counts (
  id SERIAL PRIMARY KEY,
  count_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  drawer_label VARCHAR(20) NOT NULL DEFAULT 'front',
  cash_expected DECIMAL(12, 2) NOT NULL CHECK (cash_expected >= 0),
  cash_counted DECIMAL(12, 2) NOT NULL CHECK (cash_counted >= 0),
  variance DECIMAL(12, 2) GENERATED ALWAYS AS (cash_counted - cash_expected) STORED,
  notes TEXT
);

CREATE INDEX cash_drawer_counts_date_idx ON cash_drawer_counts (count_date DESC);

-- Vendors + shipments (because somebody keeps ordering "industrial solvent")
CREATE TABLE supply_vendors (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(120) NOT NULL UNIQUE,
  contact_name VARCHAR(120),
  phone VARCHAR(20),
  email VARCHAR(100),
  category VARCHAR(50) NOT NULL,
  notes TEXT
);

CREATE TABLE chemical_shipments (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES supply_vendors(id) ON DELETE RESTRICT,
  received_date DATE NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'gallon',
  declared_use VARCHAR(200),
  storage_location VARCHAR(50) NOT NULL,
  approved_by_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  CONSTRAINT chemical_shipments_invoice_unique UNIQUE (vendor_id, invoice_number)
);

CREATE INDEX chemical_shipments_received_date_idx ON chemical_shipments (received_date DESC);

-- Storage lockers + access logs (for the "long-term storage" customers)
CREATE TABLE storage_lockers (
  id SERIAL PRIMARY KEY,
  locker_code VARCHAR(20) UNIQUE NOT NULL,
  location VARCHAR(50) NOT NULL DEFAULT 'Back Room',
  size VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (size IN ('small', 'standard', 'large')),
  monthly_rate DECIMAL(10, 2) NOT NULL CHECK (monthly_rate >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance')),
  assigned_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX storage_lockers_status_idx ON storage_lockers (status);

CREATE TABLE locker_access_log (
  id SERIAL PRIMARY KEY,
  locker_id INTEGER NOT NULL REFERENCES storage_lockers(id) ON DELETE CASCADE,
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  access_method VARCHAR(20) NOT NULL DEFAULT 'key' CHECK (access_method IN ('key', 'code', 'maintenance_override')),
  reason VARCHAR(200),
  notes TEXT
);

CREATE INDEX locker_access_log_accessed_at_idx ON locker_access_log (accessed_at DESC);

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO employees (id, first_name, last_name, role, hire_date, hourly_rate, phone, email, status, badge_code, notes) VALUES
  (1, 'Dennis', 'Markowski', 'Facility Manager', '2004-05-10', 29.00, '505-555-0707', 'dennis@lavanderia-brillante.com', 'active', 'LB-DENNIS-01', 'Knows every camera angle.'),
  (2, 'Gustavo', 'Fring', 'Owner (Silent Partner)', '2004-05-10', 0.00, '505-555-0001', 'g.fring@lavanderia-brillante.com', 'active', 'LB-GUS-00', 'Rarely on-site. Always informed.'),
  (3, 'Mike', 'Ehrmantraut', 'Security Consultant', '2009-08-15', 45.00, '505-555-0052', 'mike@proton.me', 'active', 'LB-MIKE-07', 'Good at "problem solving".'),
  (4, 'Tyrus', 'Kitt', 'Security', '2009-07-01', 30.00, '505-555-9090', NULL, 'active', 'LB-SEC-07', 'Rarely smiles.'),
  (5, 'Victor', 'St. Clair', 'Security', '2009-06-15', 30.00, '505-555-8080', NULL, 'inactive', 'LB-SEC-06', 'No longer with the company.'),
  (6, 'Lydia', 'Rodarte-Quayle', 'Logistics Coordinator', '2010-03-01', 38.00, '505-555-0051', 'lydia@madrigal.com', 'active', 'LB-LYDIA-03', 'Precise. Documents everything.'),
  (7, 'Old Joe', 'Henderson', 'Maintenance Vendor', '2008-04-12', 0.00, '505-555-0050', 'joe@salvage.com', 'active', 'LB-JOE-SALV', 'Fixes anything. Asks nothing.');

INSERT INTO customers (id, first_name, last_name, phone, email, membership_tier, credit_balance, registered_date, referral_code, notes) VALUES
  (1, 'Walter', 'White', '505-555-0001', 'heisenberg@proton.me', 'platinum', 0.00, '2008-01-15', 'BLUE99', 'VIP - Handle with care'),
  (2, 'Jesse', 'Pinkman', '505-555-0002', 'capncook@proton.me', 'platinum', 0.00, '2008-02-20', 'BLUE99', 'Associate of Mr. White'),
  (3, 'Saul', 'Goodman', '505-555-0147', 'saul@bettercallsaul.com', 'gold', 15000.00, '2008-03-10', 'LAWYER', 'Business consultant'),
  (4, 'Marie', 'Schrader', '505-555-0202', 'marie.s@gmail.com', 'silver', 25.00, '2009-02-10', 'PURPLE', 'Very particular about colors'),
  (5, 'Hank', 'Schrader', '505-555-0201', 'hank.s@gmail.com', 'standard', 0.00, '2009-02-10', NULL, 'Asks a lot of questions'),
  (6, 'Lydia', 'Rodarte-Quayle', '505-555-0051', 'lydia@madrigal.com', 'platinum', 0.00, '2010-03-01', 'INTL', 'International business partner'),
  (7, 'Todd', 'Alquist', '505-555-0666', 'todd.a@proton.me', 'gold', 0.00, '2011-09-15', NULL, 'Polite. Too polite.'),
  (8, 'Gale', 'Boetticher', '505-555-0444', 'gale.b@unm.edu', 'silver', 10.00, '2008-06-18', 'LAB', 'Brings his own detergent'),
  (9, 'Tuco', 'Salamanca', '505-555-7777', NULL, 'standard', 0.00, '2008-04-01', NULL, 'DO NOT OFFER COFFEE'),
  (10, 'Kim', 'Wexler', '505-555-0111', 'kim.w@hhm.com', 'gold', 50.00, '2009-05-22', 'PROBONO', 'Always on time');

INSERT INTO special_services (id, service_code, service_name, base_price, duration_minutes, category, requires_approval, active, description) VALUES
  -- Front-of-house laundromat services
  (1, 'WASH-REG', 'Regular Wash', 3.50, 30, 'laundry', false, true, 'Standard washing machine cycle'),
  (2, 'WASH-LRG', 'Large Load Wash', 5.00, 35, 'laundry', false, true, 'Large capacity washing machine'),
  (3, 'DRY-REG', 'Regular Dry', 2.50, 25, 'laundry', false, true, 'Standard dryer cycle'),
  (4, 'DRY-LRG', 'Large Load Dry', 3.50, 30, 'laundry', false, true, 'Large capacity dryer'),
  (5, 'FOLD', 'Folding Service', 8.00, 45, 'service', false, true, 'Professional folding service'),
  (6, 'IRON', 'Ironing Service', 12.00, 60, 'service', false, true, 'Professional ironing'),
  (7, 'DRYCLEAN', 'Dry Cleaning (Per Garment)', 11.50, 120, 'dryclean', false, true, 'Standard dry-cleaning service'),
  (8, 'STAIN-REM', 'Stain Removal', 24.99, 60, 'dryclean', true, true, 'Pre-treatment and stain removal (approval required)'),
  (9, 'PICKUP', 'Pickup & Delivery', 19.99, NULL, 'logistics', false, true, 'Pickup and delivery within city limits'),
  -- "Special" services (coded)
  (10, 'CONSULT-A', 'Business Consultation (Type A)', 5000.00, 120, 'consulting', true, true, 'Special business advisory'),
  (11, 'CONSULT-B', 'Business Consultation (Type B)', 10000.00, 180, 'consulting', true, true, 'Premium business advisory'),
  (12, 'STORAGE-L', 'Long-term Storage', 2500.00, NULL, 'storage', true, true, 'Secure long-term storage services'),
  (13, 'CLEAN-SP', 'Specialized Cleaning', 1500.00, 240, 'special', true, true, 'Deep cleaning for sensitive materials'),
  (14, 'TRANSPORT', 'Transportation Services', 3000.00, NULL, 'logistics', true, true, 'Secure transportation and handling'),
  (15, 'PROCESS-X', 'Processing Fee', 7500.00, NULL, 'processing', true, true, 'Special handling and processing fee'),
  (16, 'RUG-XL', 'Rug / Carpet Wash (XL)', 149.00, 240, 'industrial', true, true, 'Oversized textile wash; limited capacity'),
  (17, 'PRESS-XL', 'Industrial Press Cycle', 999.99, 90, 'industrial', true, true, 'Restricted access cycle. Ear protection recommended.');

INSERT INTO equipment (id, equipment_type, machine_number, location, purchase_date, status, last_service_date, notes) VALUES
  (1, 'Washer', 'W-001', 'Main Floor', '2010-01-15', 'operational', '2024-11-01', 'Heavy duty commercial'),
  (2, 'Washer', 'W-002', 'Main Floor', '2010-01-15', 'operational', '2024-11-01', 'Heavy duty commercial'),
  (3, 'Washer', 'W-003', 'Main Floor', '2010-02-20', 'operational', '2024-11-15', 'Standard capacity'),
  (4, 'Dryer', 'D-001', 'Main Floor', '2010-01-15', 'operational', '2024-10-20', 'Industrial dryer'),
  (5, 'Dryer', 'D-002', 'Main Floor', '2010-01-15', 'operational', '2024-10-20', 'Industrial dryer'),
  (6, 'Industrial Washer', 'IW-001', 'Back Room', '2010-03-01', 'operational', '2024-12-01', 'High capacity - restricted access'),
  (7, 'Industrial Dryer', 'ID-001', 'Back Room', '2010-03-01', 'operational', '2024-12-01', 'High temp capable - restricted access'),
  (8, 'Boiler', 'BLR-001', 'Utility Room', '2010-03-01', 'operational', '2024-11-25', 'Steam pressure is monitored continuously'),
  (9, 'Industrial Press', 'PR-001', 'Back Room', '2010-03-01', 'operational', '2024-12-05', 'Restricted access'),
  (10, 'Conveyor Dryer', 'CD-001', 'Back Room', '2010-03-01', 'operational', '2024-12-05', 'High throughput line'),
  (11, 'Floor Drain', 'FD-404', 'Back Room', '2010-03-01', 'maintenance', '2024-12-15', 'Clogs… frequently');

INSERT INTO equipment_maintenance (equipment_id, maintenance_date, technician_name, work_performed, parts_cost, labor_cost, next_service_date, priority) VALUES
  (6, '2024-12-01', 'Old Joe', 'Replaced heating element and recalibrated temperature controls', 850.00, 400.00, '2025-03-01', 'high'),
  (7, '2024-12-01', 'Old Joe', 'Upgraded ventilation system and installed new filters', 1200.00, 600.00, '2025-03-01', 'high'),
  (1, '2024-11-01', 'Mike''s Repair', 'Routine maintenance and cleaning', 50.00, 100.00, '2025-02-01', 'low'),
  (2, '2024-11-01', 'Mike''s Repair', 'Routine maintenance and cleaning', 50.00, 100.00, '2025-02-01', 'low'),
  (8, '2024-11-25', 'Old Joe', 'Boiler pressure valve inspection and gasket replacement', 210.00, 350.00, '2025-02-25', 'medium'),
  (9, '2024-12-05', 'Old Joe', 'Replaced press belt and lubricated rollers', 420.00, 250.00, '2025-03-05', 'medium'),
  (10, '2024-12-05', 'Old Joe', 'Conveyor alignment and belt tension calibration', 180.00, 220.00, '2025-03-05', 'low'),
  (11, '2024-12-15', 'Old Joe', 'Cleared obstruction, replaced grate, advised "don’t ask"', 35.00, 150.00, '2025-01-15', 'critical');

INSERT INTO supply_vendors (id, vendor_name, contact_name, phone, email, category, notes) VALUES
  (1, 'Madrigal Electromotive (Industrial Supplies)', 'Lydia R-Q', '505-555-3131', 'orders@madrigal.com', 'chemicals', 'Invoices are… very formal.'),
  (2, 'Vamonos Pest', 'Ira', '505-555-1919', 'dispatch@vamonospest.com', 'services', 'Exterminators with impeccable timing.'),
  (3, 'ABQ Laundry & Soap Co.', 'Cindy', '505-555-2222', 'sales@abqsoap.co', 'chemicals', 'Totally normal soap and detergent.'),
  (4, 'Joe''s Salvage & Parts', 'Old Joe', '505-555-0050', 'joe@salvage.com', 'equipment', 'Cash preferred.');

INSERT INTO chemical_shipments (vendor_id, received_date, invoice_number, item_name, quantity, unit, declared_use, storage_location, approved_by_employee_id, notes) VALUES
  (3, '2024-11-28', 'ABQ-1128-01', 'Industrial Detergent (Citrus)', 24, 'gallon', 'Commercial laundry service', 'Supply Closet', 1, NULL),
  (1, '2024-12-02', 'ME-1202-07', 'Laboratory-grade Solvent (N/A)', 12, 'gallon', 'Equipment maintenance', 'Back Room', 1, 'Label missing on 3 containers'),
  (1, '2024-12-04', 'ME-1204-02', 'Air Filtration Media (HEPA)', 6, 'crate', 'Ventilation upgrade', 'Back Room', 6, 'Signed for after closing'),
  (2, '2024-12-06', 'VP-1206-01', 'Fumigation Prep Kit', 3, 'kit', 'Scheduled treatment', 'Manager Office', 1, 'No pests observed. Curious.');

INSERT INTO storage_lockers (id, locker_code, location, size, monthly_rate, status, assigned_customer_id, notes) VALUES
  (1, 'LKR-01', 'Back Room', 'standard', 2500.00, 'assigned', 3, 'Client prefers "discreet billing"'),
  (2, 'LKR-02', 'Back Room', 'large', 3500.00, 'assigned', 1, 'Do not open without manager present'),
  (3, 'LKR-03', 'Back Room', 'standard', 2500.00, 'available', NULL, NULL),
  (4, 'LKR-04', 'Back Room', 'small', 1500.00, 'maintenance', NULL, 'Lock jammed (again)');

INSERT INTO locker_access_log (locker_id, accessed_at, employee_id, customer_id, access_method, reason, notes) VALUES
  (2, '2024-12-03 21:17:00', 3, NULL, 'maintenance_override', 'HVAC check', 'Left spotless'),
  (2, '2024-12-03 21:22:00', 1, 1, 'code', 'Storage visit', 'No questions asked'),
  (1, '2024-12-06 19:05:00', 5, 3, 'key', 'Pickup', 'Customer arrived in a hurry'),
  (2, '2024-12-10 22:10:00', 3, NULL, 'maintenance_override', 'Leak inspection', 'All clear');

INSERT INTO transactions (customer_id, service_id, transaction_date, amount, payment_method, quantity, discount_applied, processed_by_employee_id, notes, flag) VALUES
  -- Normal-ish
  (1, 1, '2024-12-01 09:15:00', 3.50, 'cash', 1, 0.00, 1, NULL, 'vip'),
  (4, 5, '2024-12-01 10:05:00', 8.00, 'debit_card', 1, 1.00, 1, 'Folded: "no creases"', 'none'),
  (5, 7, '2024-12-01 10:30:00', 11.50, 'credit_card', 1, 0.00, 1, 'One suit. Rush requested.', 'none'),
  (8, 9, '2024-12-02 14:20:00', 19.99, 'cash', 1, 0.00, 6, 'Pickup scheduled. Precise window.', 'none'),

  -- Large "consulting" / coded activity
  (1, 11, '2024-12-03 16:00:00', 10000.00, 'cash', 1, 0.00, 1, 'Q4 consulting package', 'round_number'),
  (2, 10, '2024-12-05 11:00:00', 5000.00, 'cash', 1, 0.00, 1, 'Business strategy session', 'round_number'),
  (3, 12, '2024-12-06 13:30:00', 2500.00, 'wire_transfer', 1, 0.00, 1, 'Monthly storage fee', 'vip'),
  (6, 15, '2024-12-07 10:00:00', 7500.00, 'wire_transfer', 1, 0.00, 1, 'International processing', 'manual_override'),
  (3, 14, '2024-12-08 15:00:00', 3000.00, 'cash', 1, 0.00, 6, 'Special delivery', 'after_hours'),
  (1, 11, '2024-12-10 22:45:00', 10000.00, 'cash', 1, 0.00, 1, 'Weekly consulting', 'after_hours'),
  (7, 17, '2024-12-11 21:10:00', 999.99, 'cash', 1, 0.00, 3, 'Restricted cycle requested', 'manual_override'),
  (9, 16, '2024-12-12 18:00:00', 149.00, 'cash', 1, 0.00, 4, 'Rug wash. No receipts.', 'none');

INSERT INTO cash_drawer_counts (count_date, employee_id, drawer_label, cash_expected, cash_counted, notes) VALUES
  ('2024-12-03 22:05:00', 1, 'front', 10250.00, 10250.00, 'Balanced.'),
  ('2024-12-05 21:58:00', 1, 'front', 5150.00, 5149.99, 'Variance of -$0.01. Again.'),
  ('2024-12-10 23:10:00', 1, 'front', 10050.00, 10050.00, 'After-hours reconciliation.'),
  ('2024-12-11 21:30:00', 3, 'back', 1000.00, 1000.00, 'Nothing to report.');

-- ============================================================================
-- VIEWS (screenshot-friendly)
-- ============================================================================

CREATE VIEW vw_laundromat_daily_revenue AS
SELECT
  date_trunc('day', t.transaction_date) AS day,
  COUNT(*) AS txn_count,
  SUM(t.amount) AS gross_amount,
  SUM(t.discount_applied) AS discount_amount,
  SUM(t.amount - t.discount_applied) AS net_amount,
  SUM(CASE WHEN t.payment_method = 'cash' THEN (t.amount - t.discount_applied) ELSE 0 END) AS net_cash_amount
FROM transactions t
GROUP BY 1
ORDER BY 1 DESC;

CREATE VIEW vw_laundromat_suspicious_activity AS
SELECT
  t.id,
  t.transaction_date,
  c.first_name || ' ' || c.last_name AS customer,
  s.service_code,
  s.service_name,
  t.amount,
  t.payment_method,
  t.flag,
  e.first_name || ' ' || e.last_name AS processed_by,
  t.notes
FROM transactions t
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN special_services s ON s.id = t.service_id
LEFT JOIN employees e ON e.id = t.processed_by_employee_id
WHERE t.flag <> 'none'
   OR t.amount >= 5000
ORDER BY t.transaction_date DESC;

-- Optional materialized view for “last 7 days of cash” (handy for demo filters)
CREATE MATERIALIZED VIEW mv_laundromat_cashflow_7d AS
SELECT
  date_trunc('day', t.transaction_date) AS day,
  SUM(CASE WHEN t.payment_method = 'cash' THEN (t.amount - t.discount_applied) ELSE 0 END) AS cash_net
FROM transactions t
WHERE t.transaction_date >= (CURRENT_DATE - INTERVAL '7 days')
GROUP BY 1
ORDER BY 1 DESC;

COMMIT;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO ${TEST_READ_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${TEST_READ_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${TEST_READ_USER};

GRANT ALL PRIVILEGES ON SCHEMA public TO ${TEST_ADMIN_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${TEST_ADMIN_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${TEST_ADMIN_USER};
