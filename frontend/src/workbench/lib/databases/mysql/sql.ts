const SCHEMA_NAMES_SQL = `
SELECT SCHEMA_NAME as schema_name
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
ORDER BY SCHEMA_NAME;
`

const SCHEMA_ASSETS_SQL = `
SELECT
  TABLE_NAME as table_name,
  TABLE_TYPE as table_type
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ?
ORDER BY TABLE_NAME;
`

const COLUMNS_SQL = `
SELECT
  c.COLUMN_NAME as column_name,
  c.DATA_TYPE as data_type,
  c.COLUMN_TYPE as column_type,
  c.IS_NULLABLE as is_nullable,
  c.COLUMN_DEFAULT as column_default,
  c.CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
  c.NUMERIC_PRECISION as numeric_precision,
  c.NUMERIC_SCALE as numeric_scale,
  c.COLUMN_KEY as column_key,
  c.EXTRA as extra,
  c.COLUMN_COMMENT as column_comment,
  CASE WHEN c.COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END as is_primary_key
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
ORDER BY c.ORDINAL_POSITION;
`

const INDEXES_SQL = `
SELECT
  s.INDEX_NAME as index_name,
  s.NON_UNIQUE as non_unique,
  s.INDEX_TYPE as index_type,
  GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) as columns
FROM information_schema.STATISTICS s
WHERE s.TABLE_SCHEMA = ? AND s.TABLE_NAME = ?
GROUP BY s.INDEX_NAME, s.NON_UNIQUE, s.INDEX_TYPE
ORDER BY CASE WHEN s.INDEX_NAME = 'PRIMARY' THEN 0 ELSE 1 END, s.INDEX_NAME;
`

const FOREIGN_KEYS_SQL = `
SELECT
  kcu.CONSTRAINT_NAME as constraint_name,
  kcu.COLUMN_NAME as fk_column,
  kcu.REFERENCED_TABLE_SCHEMA as ref_schema,
  kcu.REFERENCED_TABLE_NAME as ref_table,
  kcu.REFERENCED_COLUMN_NAME as ref_column,
  rc.UPDATE_RULE as on_update,
  rc.DELETE_RULE as on_delete
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
  AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE kcu.TABLE_SCHEMA = ?
  AND kcu.TABLE_NAME = ?
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;
`

const SCHEMA_COLUMNS_SQL = `
SELECT
  c.TABLE_SCHEMA as table_schema,
  c.TABLE_NAME as table_name,
  c.COLUMN_NAME as column_name,
  c.DATA_TYPE as data_type,
  c.COLUMN_TYPE as column_type,
  c.IS_NULLABLE as is_nullable,
  c.COLUMN_DEFAULT as column_default,
  c.CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
  c.NUMERIC_PRECISION as numeric_precision,
  c.NUMERIC_SCALE as numeric_scale,
  CASE WHEN c.COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END as is_primary_key
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = ?
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;
`

const ROUTINES_SQL = `
SELECT
  ROUTINE_SCHEMA as schema_name,
  ROUTINE_NAME as object_name,
  LOWER(ROUTINE_TYPE) as object_type
FROM information_schema.ROUTINES
WHERE ROUTINE_SCHEMA = ?
ORDER BY ROUTINE_NAME;
`

// Note: MySQL SHOW CREATE statements can't be parameterized
// The calling code must build the full statement with proper escaping
const SHOW_CREATE_PROCEDURE_SQL = 'SHOW CREATE PROCEDURE'
const SHOW_CREATE_FUNCTION_SQL = 'SHOW CREATE FUNCTION'

const VIEW_DEFINITION_SQL = `
SELECT VIEW_DEFINITION as create_statement
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?;
`

export {
  SCHEMA_NAMES_SQL,
  SCHEMA_ASSETS_SQL,
  COLUMNS_SQL,
  INDEXES_SQL,
  FOREIGN_KEYS_SQL,
  SCHEMA_COLUMNS_SQL,
  ROUTINES_SQL,
  SHOW_CREATE_PROCEDURE_SQL,
  SHOW_CREATE_FUNCTION_SQL,
  VIEW_DEFINITION_SQL,
}
