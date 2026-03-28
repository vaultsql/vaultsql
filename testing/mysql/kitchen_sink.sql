-- Kitchen Sink Database for MySQL
-- Comprehensive test database covering SQL features and edge cases for UI testing
-- Focus: Data types, constraints, relationships, edge cases, pagination

-- ============================================================================
-- CLEANUP
-- ============================================================================

USE kitchen_sink;

-- Disable foreign key checks to allow dropping tables with circular references
SET FOREIGN_KEY_CHECKS = 0;

-- Drop functions and procedures
DROP FUNCTION IF EXISTS calculate_distance_km;
DROP PROCEDURE IF EXISTS get_parent_summary;

-- Drop views
DROP VIEW IF EXISTS test_view_simple;
DROP VIEW IF EXISTS test_view_aggregates;
DROP VIEW IF EXISTS vw_extremely_long_view_name_for_testing_identifier_length_limits;

-- Drop tables
DROP TABLE IF EXISTS many_to_many_junction;
DROP TABLE IF EXISTS many_to_many_right;
DROP TABLE IF EXISTS many_to_many_left;
DROP TABLE IF EXISTS foreign_keys_child;
DROP TABLE IF EXISTS foreign_keys_parent;
DROP TABLE IF EXISTS uuid_pk_demo_comments;
DROP TABLE IF EXISTS uuid_pk_demo_posts;
DROP TABLE IF EXISTS uuid_pk_demo_users;
DROP TABLE IF EXISTS circular_refs_teams;
DROP TABLE IF EXISTS circular_refs_members;
DROP TABLE IF EXISTS circular_refs_orgs;
DROP TABLE IF EXISTS self_referential_hierarchy;
DROP TABLE IF EXISTS unique_constraints_multi;
DROP TABLE IF EXISTS defaults_and_nulls;
DROP TABLE IF EXISTS string_escaping_edge_cases;
DROP TABLE IF EXISTS generated_columns_test;
DROP TABLE IF EXISTS pagination_large;
DROP TABLE IF EXISTS empty_table;
DROP TABLE IF EXISTS identifier_limits_test;
DROP TABLE IF EXISTS data_types_demo;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- DATA TYPES DEMONSTRATION
-- ============================================================================

CREATE TABLE data_types_demo (
    -- Numeric types
    id INT AUTO_INCREMENT PRIMARY KEY,
    tiny_int TINYINT,
    small_int SMALLINT,
    medium_int MEDIUMINT,
    big_int BIGINT,
    decimal_col DECIMAL(10,2),
    numeric_col NUMERIC(12,4),
    float_col FLOAT,
    double_col DOUBLE,

    -- String types
    char_col CHAR(10),
    varchar_col VARCHAR(255),
    text_col TEXT,
    medium_text MEDIUMTEXT,
    long_text LONGTEXT,

    -- Date/Time types
    date_col DATE,
    time_col TIME,
    datetime_col DATETIME,
    timestamp_col TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    year_col YEAR,

    -- Boolean (TINYINT in MySQL)
    bool_col BOOLEAN,

    -- Binary
    binary_col BINARY(16),
    varbinary_col VARBINARY(255),
    blob_col BLOB,

    -- JSON
    json_col JSON,

    -- Enum and Set
    enum_col ENUM('small', 'medium', 'large', 'xlarge'),
    set_col SET('red', 'green', 'blue', 'yellow', 'orange'),

    -- Spatial (MySQL specific) - must be NOT NULL for spatial indexes
    point_col POINT NOT NULL,
    geometry_col GEOMETRY NOT NULL,

    SPATIAL INDEX idx_point_col (point_col),
    SPATIAL INDEX idx_geometry_col (geometry_col)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data with various data types
INSERT INTO data_types_demo (
    tiny_int, small_int, medium_int, big_int, decimal_col, numeric_col, float_col, double_col,
    char_col, varchar_col, text_col, medium_text, long_text,
    date_col, time_col, datetime_col, year_col,
    bool_col, binary_col, varbinary_col, blob_col, json_col,
    enum_col, set_col,
    point_col, geometry_col
) VALUES
(
    127, 32767, 8388607, 9223372036854775807, 12345.67, 1234567.8901, 3.14159, 2.718281828,
    'FIXED', 'variable length string', 'This is a long text field', 'Medium text content here', 'Very long text content here',
    '2024-01-15', '14:30:00', '2024-01-15 14:30:00', 2024,
    true, UNHEX('DEADBEEFDEADBEEFDEADBEEFDEADBEEF'), UNHEX('CAFEBABE'), UNHEX('BAADF00D'),
    '{"key": "value", "number": 42}',
    'large', 'red,blue',
    ST_GeomFromText('POINT(40.7589 -73.9851)'), ST_GeomFromText('POINT(40.7589 -73.9851)')
),
(
    -128, -32768, -8388608, -1234567890, -999.99, -0.0001, 0.0, 0.0,
    'TEST', 'unicode: 你好世界 🌍', 'Émojis and spëcial çhars: 🎉🎨🎭🎪🎯', 'More unicode: Ä Ë Ï', 'Testing',
    '2024-12-25', '23:59:59', '2024-12-31 23:59:59', 2024,
    false, NULL, NULL, NULL,
    '{"empty": null, "tags": ["test", "demo"]}',
    'small', 'green,yellow',
    ST_GeomFromText('POINT(40.7614 -73.9776)'), ST_GeomFromText('POINT(40.7614 -73.9776)')
),
(
    0, 0, 0, 0, 0.00, 0.0000, 0.0, 0.0,
    '', '', '', '', '',
    '1970-01-01', '00:00:00', '1970-01-01 00:00:00', 1970,
    false, UNHEX('00000000000000000000000000000000'), UNHEX('00'), UNHEX('00'),
    '{}',
    'medium', 'red',
    ST_GeomFromText('POINT(0 0)'), ST_GeomFromText('POINT(0 0)')
);

-- ============================================================================
-- UUID PRIMARY KEYS AND FOREIGN KEYS DEMO
-- ============================================================================

CREATE TABLE uuid_pk_demo_users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE uuid_pk_demo_posts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES uuid_pk_demo_users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE uuid_pk_demo_comments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    post_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (post_id) REFERENCES uuid_pk_demo_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES uuid_pk_demo_users(id) ON DELETE CASCADE,
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data with explicit UUIDs
INSERT INTO uuid_pk_demo_users (id, username, email) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'alice_uuid', 'alice@example.com'),
('b1ffcd88-8b1a-5df9-aa7e-7cc8ce491b22', 'bob_uuid', 'bob@example.com'),
('c2ffde77-7a09-6ef0-bb8f-8dd9df502c33', 'charlie_uuid', 'charlie@example.com');

INSERT INTO uuid_pk_demo_posts (id, user_id, title, content) VALUES
('d3eeff66-6909-7af1-cc9f-9ee0ef613d44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'First Post by Alice', 'This is Alice\'s first post with UUID primary key'),
('e4fffa55-5808-8bf2-dd0a-0ff1fa724e55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Second Post by Alice', 'Another post from Alice'),
('f5aafb44-4707-9cf3-ee1b-1ff2fb835f66', 'b1ffcd88-8b1a-5df9-aa7e-7cc8ce491b22', 'Bob\'s Thoughts', 'Bob sharing his thoughts'),
('a6bbac33-3606-0df4-ff2c-2ff3ac946a77', 'c2ffde77-7a09-6ef0-bb8f-8dd9df502c33', 'Charlie\'s Journey', 'Charlie\'s blog post');

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
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id VARCHAR(36) -- Circular reference to circular_refs_members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE circular_refs_members (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    org_id VARCHAR(36),
    FOREIGN KEY (org_id) REFERENCES circular_refs_orgs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add the foreign key for circular_refs_orgs.owner_id after members table is created
ALTER TABLE circular_refs_orgs ADD CONSTRAINT fk_owner FOREIGN KEY (owner_id) REFERENCES circular_refs_members(id) ON DELETE SET NULL;

CREATE TABLE circular_refs_teams (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    org_id VARCHAR(36),
    captain_id VARCHAR(36),
    FOREIGN KEY (org_id) REFERENCES circular_refs_orgs(id) ON DELETE CASCADE,
    FOREIGN KEY (captain_id) REFERENCES circular_refs_members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    level INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_id) REFERENCES self_referential_hierarchy(id) ON DELETE CASCADE,
    
    INDEX idx_parent (parent_id),
    INDEX idx_slug (slug),
    INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE foreign_keys_child (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    value DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_id) REFERENCES foreign_keys_parent(id) ON DELETE CASCADE,
    
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE many_to_many_right (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE many_to_many_junction (
    left_id INT,
    right_id INT,
    relationship_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (left_id, right_id),
    
    FOREIGN KEY (left_id) REFERENCES many_to_many_left(id) ON DELETE CASCADE,
    FOREIGN KEY (right_id) REFERENCES many_to_many_right(id) ON DELETE CASCADE,
    
    INDEX idx_left (left_id),
    INDEX idx_right (right_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    ssn VARCHAR(11) UNIQUE,
    code VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    
    -- Composite unique constraint
    UNIQUE KEY unique_code_category (code, category),
    
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Various default values
    status VARCHAR(20) DEFAULT 'pending',
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Nullable columns
    optional_text TEXT,
    optional_number INT,
    optional_date DATE,
    optional_json JSON,
    
    -- Non-nullable columns
    required_field VARCHAR(100) NOT NULL,
    required_number INT NOT NULL DEFAULT 0,
    
    -- CHECK constraints
    CONSTRAINT check_priority CHECK (priority >= 0 AND priority <= 10),
    CONSTRAINT check_status CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    
    INDEX idx_status (status),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    id INT AUTO_INCREMENT PRIMARY KEY,
    
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
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FULLTEXT INDEX idx_fulltext (single_quotes, double_quotes, unicode_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert edge case strings
INSERT INTO string_escaping_edge_cases (
    single_quotes, double_quotes, backslashes, newlines, tabs, mixed_quotes,
    sql_keywords, unicode_text, emoji_text, rtl_text, zero_width, very_long_text
) VALUES
(
    'It''s a string with single quotes',
    'String with "double quotes" inside',
    'Path\\with\\backslashes\\file.txt',
    'Line 1\nLine 2\nLine 3',
    'Column1\tColumn2\tColumn3',
    'Mix of ''single'' and "double" quotes',
    'SELECT * FROM table WHERE id = 1; DROP TABLE users;--',
    'Unicode: café, naïve, résumé, Ä Ë Ï Ö Ü ñ ç å',
    'Emojis: 😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘',
    'Arabic RTL: مرحبا بكم Hebrew: שלום',
    'Zero-width chars: a​b​c​d​e',
    REPEAT('This is a very long string that repeats many times. ', 50)
),
(
    'O''Reilly',
    '"Quoted" text',
    'C:\\Users\\Admin\\Documents\\',
    'First\r\nSecond\r\nThird',
    '\t\tIndented',
    'She said, "It''s fine"',
    'admin'' OR ''1''=''1',
    '中文字符 日本語 한국어 Русский Ελληνικά',
    '🎨🎭🎪🎯🎲🎰🎳🏀🏈⚽🎾🎱🏊🏄🚴',
    'עברית العربية فارسی',
    'Invisible: ‌‍​',
    CONCAT('SQL Injection: ', REPEAT('UNION SELECT ', 20))
),
(
    NULL,
    '',
    '\\\\\\',
    '\n\n\n',
    '\t',
    '''''',
    'DROP DATABASE test;',
    '™ © ® ℃ ㎡ € £ ¥',
    '🔥💯✨🎉🎊🎈',
    'مرحبا',
    '',
    REPEAT('A', 5000)
);

-- ============================================================================
-- GENERATED COLUMNS
-- ============================================================================

CREATE TABLE generated_columns_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL,
    
    -- Generated columns
    full_name VARCHAR(101) GENERATED ALWAYS AS (CONCAT(first_name, ' ', last_name)) STORED,
    total_price DECIMAL(12,2) GENERATED ALWAYS AS (price * quantity) STORED,
    price_category VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN price < 10 THEN 'cheap'
            WHEN price < 100 THEN 'moderate'
            ELSE 'expensive'
        END
    ) VIRTUAL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_full_name (full_name),
    INDEX idx_total_price (total_price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    id INT AUTO_INCREMENT PRIMARY KEY,
    value VARCHAR(100),
    category VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_status (status),
    INDEX idx_score (score),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert 5000 rows for pagination testing
DELIMITER //
CREATE PROCEDURE insert_pagination_data()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE cat VARCHAR(50);
    DECLARE stat VARCHAR(20);
    
    WHILE i <= 5000 DO
        -- Vary categories
        SET cat = CASE (i % 10)
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
        SET stat = CASE (i % 4)
            WHEN 0 THEN 'active'
            WHEN 1 THEN 'pending'
            WHEN 2 THEN 'completed'
            ELSE 'archived'
        END;
        
        INSERT INTO pagination_large (value, category, status, score) 
        VALUES (
            CONCAT('Record ', i),
            cat,
            stat,
            FLOOR(RAND() * 1000)
        );
        
        SET i = i + 1;
    END WHILE;
END//
DELIMITER ;

CALL insert_pagination_data();
DROP PROCEDURE insert_pagination_data;

-- ============================================================================
-- EMPTY TABLE
-- ============================================================================

CREATE TABLE empty_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    value DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Intentionally leave empty (no INSERT statements)

-- ============================================================================
-- IDENTIFIER LIMITS TEST
-- ============================================================================

-- Table with extremely long name (MySQL allows up to 64 characters)
CREATE TABLE identifier_limits_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Very short column names
    a INT,
    b VARCHAR(10),
    x DECIMAL(10,2),
    
    -- Very long column names (testing 64 char limit)
    this_is_a_very_long_column_name_that_tests_max_identifier VARCHAR(100),
    another_extremely_long_column_name_for_comprehensive_tests TEXT,
    
    -- Edge case names (MySQL allows backtick-quoted identifiers)
    `column-with-dashes` VARCHAR(50),
    `column.with.dots` VARCHAR(50),
    `column with spaces` VARCHAR(50),
    `COLUMN_ALL_CAPS` VARCHAR(50),
    `column_with_numbers_123456789` INT,
    `column_with_unicode_café_日本_🎉` VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_long_col (this_is_a_very_long_column_name_that_tests_max_identifier(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert test data
INSERT INTO identifier_limits_test (
    a, b, x,
    this_is_a_very_long_column_name_that_tests_max_identifier,
    another_extremely_long_column_name_for_comprehensive_tests,
    `column-with-dashes`,
    `column.with.dots`,
    `column with spaces`,
    `COLUMN_ALL_CAPS`,
    `column_with_numbers_123456789`,
    `column_with_unicode_café_日本_🎉`
) VALUES
(1, 'short', 99.99, 'Long column value', 'Another long value', 'dash-test', 'dot.test', 'space test', 'CAPS', 123456789, 'Unicode: café 🎉'),
(2, 'x', 0.01, 'Short', 'Test', 'test-1', 'test.1', 'test 1', 'TEST1', 1, '🎨'),
(3, 'abcdefghij', 999999.99, REPEAT('A', 100), REPEAT('B', 255), 'edge-case', 'edge.case', 'edge case', 'EDGE', 999999999, 'Ω≈ç√∫');

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
    this_is_a_very_long_column_name_that_tests_max_identifier as long_col_1,
    `column-with-dashes` as col_with_dashes,
    `column with spaces` as col_with_spaces
FROM identifier_limits_test;

-- ============================================================================
-- STORED FUNCTION EXAMPLE
-- ============================================================================

DELIMITER //
CREATE FUNCTION calculate_distance_km(
    lat1 DECIMAL(10,8),
    lon1 DECIMAL(11,8),
    lat2 DECIMAL(10,8),
    lon2 DECIMAL(11,8)
)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    RETURN ROUND(
        ST_Distance_Sphere(
            ST_GeomFromText(CONCAT('POINT(', lat1, ' ', lon1, ')')),
            ST_GeomFromText(CONCAT('POINT(', lat2, ' ', lon2, ')'))
        ) / 1000,
        2
    );
END//
DELIMITER ;

-- ============================================================================
-- STORED PROCEDURE EXAMPLE
-- ============================================================================

DELIMITER //
CREATE PROCEDURE get_parent_summary(IN parent_id_param INT)
BEGIN
    SELECT 
        p.id,
        p.name,
        p.code,
        COUNT(c.id) as child_count,
        COALESCE(SUM(c.value), 0) as total_value
    FROM foreign_keys_parent p
    LEFT JOIN foreign_keys_child c ON p.id = c.parent_id
    WHERE p.id = parent_id_param
    GROUP BY p.id, p.name, p.code;
END//
DELIMITER ;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON kitchen_sink.* TO 'demo_read'@'%';
GRANT EXECUTE ON kitchen_sink.* TO 'demo_read'@'%';
GRANT ALL PRIVILEGES ON kitchen_sink.* TO 'demo_admin'@'%';
FLUSH PRIVILEGES;

-- ============================================================================
-- HELPFUL QUERIES FOR TESTING
-- ============================================================================

-- Example: Test pagination
-- SELECT * FROM pagination_large ORDER BY id LIMIT 100 OFFSET 0;
-- SELECT * FROM pagination_large WHERE category = 'Category A' ORDER BY created_at DESC LIMIT 50;

-- Example: Test full-text search
-- SELECT * FROM string_escaping_edge_cases WHERE MATCH(single_quotes, double_quotes, unicode_text) AGAINST('unicode' IN NATURAL LANGUAGE MODE);

-- Example: Test hierarchical queries (requires recursive CTE in MySQL 8.0+)
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
-- SELECT first_name, last_name, full_name, price, quantity, total_price, price_category FROM generated_columns_test;

-- Example: Test views
-- SELECT * FROM test_view_simple;
-- SELECT * FROM test_view_aggregates ORDER BY total_value DESC;

-- Example: Test function
-- SELECT calculate_distance_km(40.7589, -73.9851, 40.7614, -73.9776) as distance;

-- Example: Test procedure
-- CALL get_parent_summary(1);
