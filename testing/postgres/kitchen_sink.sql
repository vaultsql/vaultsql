-- Kitchen Sink Database for PostgreSQL
-- Comprehensive test database covering SQL features and edge cases for UI testing
-- Focus: Data types, constraints, relationships, edge cases, pagination

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS test_materialized_view CASCADE;

-- Drop views
DROP VIEW IF EXISTS test_view_simple CASCADE;
DROP VIEW IF EXISTS test_view_aggregates CASCADE;
DROP VIEW IF EXISTS vw_extremely_long_view_name_for_testing_identifier_length_limits CASCADE;

-- Drop tables
DROP TABLE IF EXISTS many_to_many_junction CASCADE;
DROP TABLE IF EXISTS many_to_many_right CASCADE;
DROP TABLE IF EXISTS many_to_many_left CASCADE;
DROP TABLE IF EXISTS foreign_keys_child CASCADE;
DROP TABLE IF EXISTS foreign_keys_parent CASCADE;
DROP TABLE IF EXISTS uuid_pk_demo_comments CASCADE;
DROP TABLE IF EXISTS uuid_pk_demo_posts CASCADE;
DROP TABLE IF EXISTS uuid_pk_demo_users CASCADE;
DROP TABLE IF EXISTS circular_refs_teams CASCADE;
DROP TABLE IF EXISTS circular_refs_members CASCADE;
DROP TABLE IF EXISTS circular_refs_orgs CASCADE;
DROP TABLE IF EXISTS self_referential_hierarchy CASCADE;
DROP TABLE IF EXISTS unique_constraints_multi CASCADE;
DROP TABLE IF EXISTS defaults_and_nulls CASCADE;
DROP TABLE IF EXISTS string_escaping_edge_cases CASCADE;
DROP TABLE IF EXISTS generated_columns_test CASCADE;
DROP TABLE IF EXISTS pagination_large CASCADE;
DROP TABLE IF EXISTS empty_table CASCADE;
DROP TABLE IF EXISTS identifier_limits_test CASCADE;
DROP TABLE IF EXISTS data_types_demo CASCADE;

-- ============================================================================
-- DATA TYPES DEMONSTRATION
-- ============================================================================

CREATE TABLE data_types_demo (
    -- Numeric types
    id SERIAL PRIMARY KEY,
    small_int SMALLINT,
    big_int BIGINT,
    decimal_col DECIMAL(10,2),
    numeric_col NUMERIC(12,4),
    real_col REAL,
    double_col DOUBLE PRECISION,

    -- String types
    char_col CHAR(10),
    varchar_col VARCHAR(255),
    text_col TEXT,

    -- Date/Time types
    date_col DATE,
    time_col TIME,
    timestamp_col TIMESTAMP,
    timestamp_tz_col TIMESTAMPTZ,
    interval_col INTERVAL,

    -- Boolean
    bool_col BOOLEAN,

    -- Binary
    bytea_col BYTEA,

    -- JSON
    json_col JSON,
    jsonb_col JSONB,

    -- Array (PostgreSQL specific)
    int_array INTEGER[],
    text_array TEXT[],

    -- UUID
    uuid_col UUID,

    -- Network types (PostgreSQL specific)
    inet_col INET,
    macaddr_col MACADDR,

    -- Range types (PostgreSQL specific)
    int_range INT4RANGE,
    date_range DATERANGE,
    timestamp_range TSRANGE,

    -- Full-text search
    search_vector TSVECTOR,

    -- Geometric types
    point_col POINT,
    
    -- Money type
    money_col MONEY
);

-- Insert sample data with various data types
INSERT INTO data_types_demo (
    small_int, big_int, decimal_col, numeric_col, real_col, double_col,
    char_col, varchar_col, text_col,
    date_col, time_col, timestamp_col, timestamp_tz_col, interval_col,
    bool_col, bytea_col, json_col, jsonb_col,
    int_array, text_array, uuid_col, inet_col, macaddr_col,
    int_range, date_range, timestamp_range,
    search_vector, point_col, money_col
) VALUES
(
    123, 9223372036854775807, 12345.67, 1234567.8901, 3.14159, 2.718281828,
    'FIXED     ', 'variable length string', 'This is a long text field that can contain much more data than varchar',
    '2024-01-15', '14:30:00', '2024-01-15 14:30:00', '2024-01-15 14:30:00-07', '2 days 3 hours',
    true, '\xDEADBEEF'::bytea, '{"key": "value", "number": 42}'::json, '{"nested": {"data": [1,2,3]}}'::jsonb,
    ARRAY[1,2,3,4,5], ARRAY['apple', 'banana', 'cherry'], 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
    '192.168.1.1'::inet, '08:00:2b:01:02:03'::macaddr,
    '[1,10)'::int4range, '[2024-01-01,2024-12-31]'::daterange, '[2024-01-01 00:00:00,2024-01-01 23:59:59]'::tsrange,
    to_tsvector('english', 'The quick brown fox jumps over the lazy dog'),
    POINT(40.7589, -73.9851),
    '$1234.56'::money
),
(
    -456, -1234567890, -999.99, -0.0001, 0.0, 0.0,
    'TEST', 'unicode: 你好世界 🌍', 'Émojis and spëcial çhars: 🎉🎨🎭🎪🎯',
    '2024-12-25', '23:59:59', '2024-12-31 23:59:59', '2024-12-31 23:59:59+00', '1 year 2 months',
    false, '\x00'::bytea, '{"empty": null}'::json, '{"tags": ["test", "demo"]}'::jsonb,
    ARRAY[0], ARRAY['🍎', '🍌', '🍒'], 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
    '2001:0db8:85a3:0000:0000:8a2e:0370:7334'::inet, '00:00:00:00:00:00'::macaddr,
    '[100,200]'::int4range, '[2025-01-01,2025-12-31)'::daterange, '[2025-06-01 09:00:00,2025-06-01 17:00:00)'::tsrange,
    to_tsvector('english', 'PostgreSQL is a powerful open source database'),
    POINT(40.7614, -73.9776),
    '$0.00'::money
),
(
    0, 0, 0.00, 0.0000, 0.0, 0.0,
    '', '', '',
    '1970-01-01', '00:00:00', '1970-01-01 00:00:00', '1970-01-01 00:00:00+00', '0 seconds',
    false, '\x00'::bytea, '{}'::json, '{}'::jsonb,
    ARRAY[]::integer[], ARRAY[]::text[], '00000000-0000-0000-0000-000000000000'::uuid,
    '0.0.0.0'::inet, '00:00:00:00:00:00'::macaddr,
    '[0,0]'::int4range, '[1970-01-01,1970-01-01]'::daterange, '[1970-01-01 00:00:00,1970-01-01 00:00:00]'::tsrange,
    to_tsvector('english', ''),
    POINT(0, 0),
    '$-999.99'::money
);

-- ============================================================================
-- UUID PRIMARY KEYS AND FOREIGN KEYS DEMO
-- ============================================================================

CREATE TABLE uuid_pk_demo_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE uuid_pk_demo_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES uuid_pk_demo_users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE uuid_pk_demo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES uuid_pk_demo_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES uuid_pk_demo_users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for UUID foreign keys
CREATE INDEX idx_posts_user_id ON uuid_pk_demo_posts(user_id);
CREATE INDEX idx_comments_post_id ON uuid_pk_demo_comments(post_id);
CREATE INDEX idx_comments_user_id ON uuid_pk_demo_comments(user_id);

-- Insert sample data with explicit UUIDs
INSERT INTO uuid_pk_demo_users (id, username, email) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'alice_uuid', 'alice@example.com'),
('b1ffcd88-8b1a-5df9-aa7e-7cc8ce491b22', 'bob_uuid', 'bob@example.com'),
('c2ffde77-7a09-6ef0-bb8f-8dd9df502c33', 'charlie_uuid', 'charlie@example.com');

INSERT INTO uuid_pk_demo_posts (id, user_id, title, content) VALUES
('d3eeff66-6909-7af1-cc9f-9ee0ef613d44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'First Post by Alice', 'This is Alice''s first post with UUID primary key'),
('e4fffa55-5808-8bf2-dd0a-0ff1fa724e55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Second Post by Alice', 'Another post from Alice'),
('f5aafb44-4707-9cf3-ee1b-1ff2fb835f66', 'b1ffcd88-8b1a-5df9-aa7e-7cc8ce491b22', 'Bob''s Thoughts', 'Bob sharing his thoughts'),
('a6bbac33-3606-0df4-ff2c-2ff3ac946a77', 'c2ffde77-7a09-6ef0-bb8f-8dd9df502c33', 'Charlie''s Journey', 'Charlie''s blog post');

INSERT INTO uuid_pk_demo_comments (post_id, user_id, comment_text) VALUES
('d3eeff66-6909-7af1-cc9f-9ee0ef613d44', 'b1ffcd88-8b1a-5df9-aa7e-7cc8ce491b22', 'Great post, Alice!'),
('d3eeff66-6909-7af1-cc9f-9ee0ef613d44', 'c2ffde77-7a09-6ef0-bb8f-8dd9df502c33', 'Very interesting perspective'),
('f5aafb44-4707-9cf3-ee1b-1ff2fb835f66', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Thanks for sharing, Bob!'),
('a6bbac33-3606-0df4-ff2c-2ff3ac946a77', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Love this story'),
('a6bbac33-3606-0df4-ff2c-2ff3ac946a77', 'b1ffcd88-8b1a-5df9-aa7e-7cc8ce491b22', 'Keep it up, Charlie!');

-- ============================================================================
-- CIRCULAR FOREIGN KEY REFERENCES (UUID)
-- ============================================================================

CREATE TABLE circular_refs_orgs (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id UUID -- Circular reference to circular_refs_members(id)
);

CREATE TABLE circular_refs_members (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    org_id UUID REFERENCES circular_refs_orgs(id) ON DELETE CASCADE
);

-- Add the foreign key for circular_refs_orgs.owner_id after members table is created
ALTER TABLE circular_refs_orgs ADD CONSTRAINT fk_owner FOREIGN KEY (owner_id) REFERENCES circular_refs_members(id) ON DELETE SET NULL;

CREATE TABLE circular_refs_teams (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    org_id UUID REFERENCES circular_refs_orgs(id) ON DELETE CASCADE,
    captain_id UUID REFERENCES circular_refs_members(id) ON DELETE SET NULL
);

-- Insert UUID data
INSERT INTO circular_refs_orgs (id, name) VALUES 
('11111111-1111-1111-1111-111111111111', 'Acme Corp'),
('22222222-2222-2222-2222-222222222222', 'Globex Corporation');

INSERT INTO circular_refs_members (id, name, org_id) VALUES
('33333333-3333-3333-3333-333333333333', 'Alice Smith', '11111111-1111-1111-1111-111111111111'),
('44444444-4444-4444-4444-444444444444', 'Bob Jones', '11111111-1111-1111-1111-111111111111'),
('55555555-5555-5555-5555-555555555555', 'Charlie Brown', '22222222-2222-2222-2222-222222222222');

UPDATE circular_refs_orgs SET owner_id = '33333333-3333-3333-3333-333333333333' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE circular_refs_orgs SET owner_id = '55555555-5555-5555-5555-555555555555' WHERE id = '22222222-2222-2222-2222-222222222222';

INSERT INTO circular_refs_teams (id, name, org_id, captain_id) VALUES
('66666666-6666-6666-6666-666666666666', 'Team Alpha', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
('77777777-7777-7777-7777-777777777777', 'Team Beta', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444');

-- ============================================================================
-- SELF-REFERENTIAL HIERARCHY
-- ============================================================================

CREATE TABLE self_referential_hierarchy (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES self_referential_hierarchy(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    level INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent self-reference
    CONSTRAINT no_self_reference CHECK (id != parent_id)
);

-- Indexes
CREATE INDEX idx_hierarchy_parent ON self_referential_hierarchy(parent_id);
CREATE INDEX idx_hierarchy_slug ON self_referential_hierarchy(slug);
CREATE INDEX idx_hierarchy_sort ON self_referential_hierarchy(sort_order);

-- Insert hierarchical data
INSERT INTO self_referential_hierarchy (id, parent_id, name, slug, level, sort_order) VALUES
(1, NULL, 'Root Level 1', 'root-1', 0, 1),
(2, NULL, 'Root Level 2', 'root-2', 0, 2),
(3, 1, 'Child 1-1', 'child-1-1', 1, 1),
(4, 1, 'Child 1-2', 'child-1-2', 1, 2),
(5, 2, 'Child 2-1', 'child-2-1', 1, 1),
(6, 3, 'Grandchild 1-1-1', 'grandchild-1-1-1', 2, 1),
(7, 3, 'Grandchild 1-1-2', 'grandchild-1-1-2', 2, 2),
(8, 6, 'Great-grandchild 1-1-1-1', 'great-grandchild-1-1-1-1', 3, 1);

-- ============================================================================
-- SIMPLE FOREIGN KEYS (Parent/Child)
-- ============================================================================

CREATE TABLE foreign_keys_parent (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE foreign_keys_child (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER NOT NULL REFERENCES foreign_keys_parent(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    value DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_child_parent ON foreign_keys_child(parent_id);

-- Insert parent/child data
INSERT INTO foreign_keys_parent (name, code) VALUES
('Parent A', 'PA001'),
('Parent B', 'PB002'),
('Parent C', 'PC003');

INSERT INTO foreign_keys_child (parent_id, name, value) VALUES
(1, 'Child A1', 100.50),
(1, 'Child A2', 200.75),
(1, 'Child A3', 300.00),
(2, 'Child B1', 150.25),
(2, 'Child B2', 250.50),
(3, 'Child C1', 175.00);

-- ============================================================================
-- MANY-TO-MANY RELATIONSHIP
-- ============================================================================

CREATE TABLE many_to_many_left (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE many_to_many_right (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE many_to_many_junction (
    left_id INTEGER REFERENCES many_to_many_left(id) ON DELETE CASCADE,
    right_id INTEGER REFERENCES many_to_many_right(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (left_id, right_id)
);

-- Indexes
CREATE INDEX idx_junction_left ON many_to_many_junction(left_id);
CREATE INDEX idx_junction_right ON many_to_many_junction(right_id);

-- Insert many-to-many data
INSERT INTO many_to_many_left (name) VALUES ('Left 1'), ('Left 2'), ('Left 3');
INSERT INTO many_to_many_right (name) VALUES ('Right A'), ('Right B'), ('Right C'), ('Right D');

INSERT INTO many_to_many_junction (left_id, right_id, relationship_type) VALUES
(1, 1, 'primary'),
(1, 2, 'secondary'),
(2, 2, 'primary'),
(2, 3, 'primary'),
(3, 1, 'secondary'),
(3, 4, 'primary');

-- ============================================================================
-- MULTIPLE UNIQUE CONSTRAINTS
-- ============================================================================

CREATE TABLE unique_constraints_multi (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    ssn VARCHAR(11) UNIQUE,
    code VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    
    -- Composite unique constraint
    UNIQUE(code, category)
);

-- Indexes
CREATE INDEX idx_unique_email ON unique_constraints_multi(email);
CREATE INDEX idx_unique_username ON unique_constraints_multi(username);

-- Insert data with unique constraints
INSERT INTO unique_constraints_multi (email, username, phone, ssn, code, category) VALUES
('user1@example.com', 'user1', '555-0001', '123-45-6789', 'CODE001', 'A'),
('user2@example.com', 'user2', '555-0002', '987-65-4321', 'CODE002', 'A'),
('user3@example.com', 'user3', '555-0003', NULL, 'CODE001', 'B'),
('user4@example.com', 'user4', NULL, NULL, 'CODE003', 'A');

-- ============================================================================
-- DEFAULTS AND NULLS
-- ============================================================================

CREATE TABLE defaults_and_nulls (
    id SERIAL PRIMARY KEY,
    
    -- Various default values
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Nullable columns
    optional_text TEXT,
    optional_number INTEGER,
    optional_date DATE,
    optional_json JSONB,
    
    -- Non-nullable columns
    required_field VARCHAR(100) NOT NULL,
    required_number INTEGER NOT NULL DEFAULT 0,
    
    -- CHECK constraints
    CONSTRAINT check_priority CHECK (priority >= 0 AND priority <= 10),
    CONSTRAINT check_status CHECK (status IN ('pending', 'active', 'completed', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_defaults_status ON defaults_and_nulls(status);
CREATE INDEX idx_defaults_active ON defaults_and_nulls(is_active) WHERE is_active = true; -- Partial index

-- Insert data with various NULL and DEFAULT combinations
INSERT INTO defaults_and_nulls (required_field, required_number, optional_text, optional_number, optional_date) VALUES
('Record 1', 100, 'Some text', 42, '2024-01-15'),
('Record 2', 200, NULL, NULL, NULL),
('Record 3', 0, '', 0, '1970-01-01'),
('Record 4', -50, 'Text with unicode: 你好 🌍', NULL, '2024-12-31');

-- Insert using defaults
INSERT INTO defaults_and_nulls (required_field) VALUES ('Record 5 with defaults');

-- ============================================================================
-- STRING ESCAPING AND EDGE CASES
-- ============================================================================

CREATE TABLE string_escaping_edge_cases (
    id SERIAL PRIMARY KEY,
    
    -- Various string edge cases
    single_quotes VARCHAR(255),
    double_quotes VARCHAR(255),
    backslashes VARCHAR(255),
    newlines TEXT,
    tabs TEXT,
    mixed_quotes TEXT,
    sql_keywords VARCHAR(255),
    unicode_text TEXT,
    emoji_text TEXT,
    rtl_text TEXT,
    zero_width TEXT,
    very_long_text TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search index
CREATE INDEX idx_escaping_fts ON string_escaping_edge_cases USING GIN(to_tsvector('english', coalesce(single_quotes, '') || ' ' || coalesce(double_quotes, '') || ' ' || coalesce(unicode_text, '')));

-- Insert edge case strings
INSERT INTO string_escaping_edge_cases (
    single_quotes, double_quotes, backslashes, newlines, tabs, mixed_quotes,
    sql_keywords, unicode_text, emoji_text, rtl_text, zero_width, very_long_text
) VALUES
(
    'It''s a string with single quotes',
    'String with "double quotes" inside',
    E'Path\\with\\backslashes\\file.txt',
    E'Line 1\nLine 2\nLine 3',
    E'Column1\tColumn2\tColumn3',
    'Mix of ''single'' and "double" quotes',
    'SELECT * FROM table WHERE id = 1; DROP TABLE users;--',
    'Unicode: café, naïve, résumé, Ä Ë Ï Ö Ü ñ ç å',
    'Emojis: 😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘',
    'Arabic RTL: مرحبا بكم Hebrew: שלום',
    'Zero-width chars: a​b​c​d​e',
    repeat('This is a very long string that repeats many times. ', 50)
),
(
    'O''Reilly',
    '"Quoted" text',
    E'C:\\Users\\Admin\\Documents\\',
    E'First\r\nSecond\r\nThird',
    E'\t\tIndented',
    'She said, "It''s fine"',
    'admin'' OR ''1''=''1',
    '中文字符 日本語 한국어 Русский Ελληνικά',
    '🎨🎭🎪🎯🎲🎰🎳🏀🏈⚽🎾🎱🏊🏄🚴',
    'עברית العربية فارسی',
    'Invisible: ‌‍​',
    'SQL Injection: ' || repeat('UNION SELECT ', 20)
),
(
    NULL,
    '',
    E'\\\\\\',
    E'\n\n\n',
    E'\t',
    '''''',
    'DROP DATABASE test;',
    '™ © ® ℃ ㎡ € £ ¥',
    '🔥💯✨🎉🎊🎈',
    'مرحبا',
    '',
    repeat('A', 5000)
);

-- ============================================================================
-- GENERATED COLUMNS
-- ============================================================================

CREATE TABLE generated_columns_test (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    
    -- Generated columns (PostgreSQL uses GENERATED ALWAYS AS ... STORED)
    full_name VARCHAR(101) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    total_price DECIMAL(12,2) GENERATED ALWAYS AS (price * quantity) STORED,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_generated_full_name ON generated_columns_test(full_name);
CREATE INDEX idx_generated_total_price ON generated_columns_test(total_price);

-- Insert data (generated columns auto-populate)
INSERT INTO generated_columns_test (first_name, last_name, price, quantity) VALUES
('John', 'Doe', 25.50, 3),
('Jane', 'Smith', 150.00, 2),
('Bob', 'Johnson', 5.99, 10),
('Alice', 'Williams', 999.99, 1),
('Charlie', 'Brown', 45.00, 5);

-- ============================================================================
-- PAGINATION TEST (5000 rows)
-- ============================================================================

CREATE TABLE pagination_large (
    id SERIAL PRIMARY KEY,
    value VARCHAR(100),
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    score INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_pagination_category ON pagination_large(category);
CREATE INDEX idx_pagination_status ON pagination_large(status);
CREATE INDEX idx_pagination_score ON pagination_large(score);
CREATE INDEX idx_pagination_created ON pagination_large(created_at);

-- Insert 5000 rows for pagination testing
DO $$
DECLARE
    i INTEGER;
    cat VARCHAR(50);
    stat VARCHAR(20);
BEGIN
    FOR i IN 1..5000 LOOP
        -- Vary categories
        cat := CASE (i % 10)
            WHEN 0 THEN 'Category A'
            WHEN 1 THEN 'Category B'
            WHEN 2 THEN 'Category C'
            WHEN 3 THEN 'Category D'
            WHEN 4 THEN 'Category E'
            WHEN 5 THEN 'Category F'
            WHEN 6 THEN 'Category G'
            WHEN 7 THEN 'Category H'
            WHEN 8 THEN 'Category I'
            ELSE 'Category J'
        END;
        
        -- Vary status
        stat := CASE (i % 4)
            WHEN 0 THEN 'active'
            WHEN 1 THEN 'pending'
            WHEN 2 THEN 'completed'
            ELSE 'archived'
        END;
        
        INSERT INTO pagination_large (value, category, status, score) 
        VALUES (
            'Record ' || i,
            cat,
            stat,
            floor(random() * 1000)::int
        );
    END LOOP;
END $$;

-- ============================================================================
-- EMPTY TABLE
-- ============================================================================

CREATE TABLE empty_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    value DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_empty_name ON empty_table(name);
CREATE INDEX idx_empty_active ON empty_table(is_active) WHERE is_active = true;

-- Intentionally leave empty (no INSERT statements)

-- ============================================================================
-- IDENTIFIER LIMITS TEST
-- ============================================================================

-- Table with extremely long name (PostgreSQL allows up to 63 characters)
CREATE TABLE identifier_limits_test (
    id SERIAL PRIMARY KEY,
    
    -- Very short column names
    a INTEGER,
    b VARCHAR(10),
    x DECIMAL(10,2),
    
    -- Very long column names (PostgreSQL truncates to 63 chars)
    very_long_column_name_testing_max_identifier_length_limit VARCHAR(100),
    another_long_column_name_for_comprehensive_testing_purposes TEXT,
    
    -- Edge case names (PostgreSQL allows quoted identifiers)
    "column-with-dashes" VARCHAR(50),
    "column.with.dots" VARCHAR(50),
    "column with spaces" VARCHAR(50),
    "COLUMN_ALL_CAPS" VARCHAR(50),
    "column_with_numbers_123456789" INTEGER,
    "column_with_unicode_café_日本_🎉" VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_limits_long_col ON identifier_limits_test(very_long_column_name_testing_max_identifier_length_limit);

-- Insert test data
INSERT INTO identifier_limits_test (
    a, b, x,
    very_long_column_name_testing_max_identifier_length_limit,
    another_long_column_name_for_comprehensive_testing_purposes,
    "column-with-dashes",
    "column.with.dots",
    "column with spaces",
    "COLUMN_ALL_CAPS",
    "column_with_numbers_123456789",
    "column_with_unicode_café_日本_🎉"
) VALUES
(1, 'short', 99.99, 'Long column value', 'Another long value', 'dash-test', 'dot.test', 'space test', 'CAPS', 123456789, 'Unicode: café 🎉'),
(2, 'x', 0.01, 'Short', 'Test', 'test-1', 'test.1', 'test 1', 'TEST1', 1, '🎨'),
(3, 'abcdefghij', 999999.99, repeat('A', 100), repeat('B', 255), 'edge-case', 'edge.case', 'edge case', 'EDGE', 999999999, 'Ω≈ç√∫');

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Simple view joining tables
CREATE VIEW test_view_simple AS
SELECT 
    p.id as parent_id,
    p.name as parent_name,
    p.code,
    c.id as child_id,
    c.name as child_name,
    c.value
FROM foreign_keys_parent p
LEFT JOIN foreign_keys_child c ON p.id = c.parent_id;

-- Aggregate view with GROUP BY
CREATE VIEW test_view_aggregates AS
SELECT 
    p.id,
    p.name,
    p.code,
    COUNT(c.id) as child_count,
    COALESCE(SUM(c.value), 0) as total_value,
    COALESCE(AVG(c.value), 0) as avg_value,
    COALESCE(MAX(c.value), 0) as max_value,
    COALESCE(MIN(c.value), 0) as min_value
FROM foreign_keys_parent p
LEFT JOIN foreign_keys_child c ON p.id = c.parent_id
GROUP BY p.id, p.name, p.code;

-- View with long name for identifier testing
CREATE VIEW vw_extremely_long_view_name_for_testing_identifier_length_limits AS
SELECT 
    id,
    a as short_a,
    b as short_b,
    very_long_column_name_testing_max_identifier_length_limit as long_col_1,
    "column-with-dashes" as col_with_dashes,
    "column with spaces" as col_with_spaces
FROM identifier_limits_test;

-- ============================================================================
-- MATERIALIZED VIEW (PostgreSQL specific)
-- ============================================================================

CREATE MATERIALIZED VIEW test_materialized_view AS
SELECT 
    p.id,
    p.name,
    p.code,
    COUNT(c.id) as child_count,
    COALESCE(SUM(c.value), 0) as total_value,
    CURRENT_TIMESTAMP as last_updated
FROM foreign_keys_parent p
LEFT JOIN foreign_keys_child c ON p.id = c.parent_id
GROUP BY p.id, p.name, p.code;

-- Create index on materialized view
CREATE INDEX idx_materialized_total ON test_materialized_view(total_value DESC);

-- ============================================================================
-- STORED FUNCTION EXAMPLE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DECIMAL,
    lon1 DECIMAL,
    lat2 DECIMAL,
    lon2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(CAST(
        (point(lon1, lat1) <-> point(lon2, lat2)) * 111.32 AS NUMERIC
    ), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STORED PROCEDURE EXAMPLE
-- ============================================================================

CREATE OR REPLACE PROCEDURE get_parent_summary(parent_id_param INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'Getting summary for parent ID: %', parent_id_param;
    
    PERFORM 
        p.id,
        p.name,
        p.code,
        COUNT(c.id) as child_count,
        COALESCE(SUM(c.value), 0) as total_value
    FROM foreign_keys_parent p
    LEFT JOIN foreign_keys_child c ON p.id = c.parent_id
    WHERE p.id = parent_id_param
    GROUP BY p.id, p.name, p.code;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO demo_read;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO demo_read;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO demo_read;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO demo_read;

GRANT ALL PRIVILEGES ON SCHEMA public TO demo_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO demo_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO demo_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO demo_admin;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO demo_admin;

-- ============================================================================
-- HELPFUL QUERIES FOR TESTING
-- ============================================================================

-- Example: Test pagination
-- SELECT * FROM pagination_large ORDER BY id LIMIT 100 OFFSET 0;
-- SELECT * FROM pagination_large WHERE category = 'Category A' ORDER BY created_at DESC LIMIT 50;

-- Example: Test full-text search
-- SELECT * FROM string_escaping_edge_cases WHERE to_tsvector('english', coalesce(single_quotes, '') || ' ' || coalesce(unicode_text, '')) @@ to_tsquery('english', 'unicode');

-- Example: Test hierarchical queries (recursive CTE)
-- WITH RECURSIVE hierarchy AS (
--   SELECT id, parent_id, name, slug, 0 as depth
--   FROM self_referential_hierarchy WHERE parent_id IS NULL
--   UNION ALL
--   SELECT c.id, c.parent_id, c.name, c.slug, h.depth + 1
--   FROM self_referential_hierarchy c
--   JOIN hierarchy h ON c.parent_id = h.id
-- )
-- SELECT * FROM hierarchy ORDER BY depth, id;

-- Example: Test generated columns
-- SELECT first_name, last_name, full_name, price, quantity, total_price FROM generated_columns_test;

-- Example: Test views
-- SELECT * FROM test_view_simple;
-- SELECT * FROM test_view_aggregates ORDER BY total_value DESC;

-- Example: Test materialized view
-- SELECT * FROM test_materialized_view;
-- REFRESH MATERIALIZED VIEW test_materialized_view;

-- Example: Test function
-- SELECT calculate_distance_km(40.7589, -73.9851, 40.7614, -73.9776) as distance;

-- Example: Test procedure
-- CALL get_parent_summary(1);

-- Example: Test arrays
-- SELECT * FROM data_types_demo WHERE 3 = ANY(int_array);
-- SELECT * FROM data_types_demo WHERE text_array @> ARRAY['apple'];

-- Example: Test JSONB
-- SELECT * FROM data_types_demo WHERE jsonb_col @> '{"nested": {"data": [1]}}';
-- SELECT jsonb_col->'nested'->'data' FROM data_types_demo WHERE jsonb_col IS NOT NULL;

-- Example: Test ranges
-- SELECT * FROM data_types_demo WHERE int_range @> 5;
-- SELECT * FROM data_types_demo WHERE date_range && '[2024-06-01,2024-06-30]'::daterange;
