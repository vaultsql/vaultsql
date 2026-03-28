const SCHEMA_NAMES_SQL = `
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;
`

const SCHEMA_ASSETS_SQL = `
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = $1
ORDER BY table_name;
`

const COLUMNS_SQL = `
SELECT
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  COALESCE(
    (SELECT true FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY'
       AND tc.table_schema = c.table_schema
       AND tc.table_name = c.table_name
       AND kcu.column_name = c.column_name),
    false
  ) as is_primary_key,
  pgd.description as column_comment
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables psat
  ON c.table_schema = psat.schemaname AND c.table_name = psat.relname
LEFT JOIN pg_catalog.pg_description pgd
  ON psat.relid = pgd.objoid AND c.ordinal_position = pgd.objsubid
WHERE c.table_schema = $1 AND c.table_name = $2
ORDER BY c.ordinal_position;
`

const INDEXES_SQL = `
SELECT
  i.relname as index_name,
  ix.indisunique as is_unique,
  ix.indisprimary as is_primary,
  am.amname as index_type,
  array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
FROM pg_index ix
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_am am ON am.oid = i.relam
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE n.nspname = $1 AND t.relname = $2
GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
ORDER BY ix.indisprimary DESC, i.relname;
`

const FOREIGN_KEYS_SQL = `
SELECT
    c.conname AS constraint_name,
    a.attname AS fk_column,
    fn.nspname AS ref_schema,
    fc.relname AS ref_table,
    af.attname AS ref_column,
    CASE c.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS on_update,
    CASE c.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END AS on_delete
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_class fc ON fc.oid = c.confrelid
JOIN pg_namespace fn ON fn.oid = fc.relnamespace
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.contype = 'f'
  AND n.nspname = $1
  AND t.relname = $2
ORDER BY c.conname, a.attnum;
`

const SCHEMA_COLUMNS_SQL = `
SELECT
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  COALESCE(
    (SELECT true FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY'
       AND tc.table_schema = c.table_schema
       AND tc.table_name = c.table_name
       AND kcu.column_name = c.column_name),
    false
  ) as is_primary_key
FROM information_schema.columns c
WHERE c.table_schema = $1
ORDER BY c.table_name, c.ordinal_position;
`

const MATERIALIZED_VIEWS_SQL = `
SELECT
  schemaname as schema_name,
  matviewname as object_name,
  'materialized_view' as object_type
FROM pg_matviews
WHERE schemaname = $1
ORDER BY matviewname;
`

const ROUTINES_SQL = `
SELECT
  n.nspname as schema_name,
  p.proname as object_name,
  CASE
    WHEN p.prokind = 'p' THEN 'procedure'
    WHEN p.prokind = 'f' THEN 'function'
    ELSE 'function'
  END as object_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = $1
  AND p.prokind IN ('f', 'p')
ORDER BY p.proname;
`

const FUNCTION_DEFINITION_SQL = `
SELECT pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = $1
  AND p.proname = $2
LIMIT 1;
`

const MATERIALIZED_VIEW_DEFINITION_SQL = `
SELECT definition
FROM pg_matviews
WHERE schemaname = $1
  AND matviewname = $2;
`

const VIEW_DEFINITION_SQL = `
SELECT pg_get_viewdef('"$1"."$2"'::regclass, true) as create_statement;
`

export {
  SCHEMA_NAMES_SQL,
  SCHEMA_ASSETS_SQL,
  COLUMNS_SQL,
  INDEXES_SQL,
  FOREIGN_KEYS_SQL,
  SCHEMA_COLUMNS_SQL,
  MATERIALIZED_VIEWS_SQL,
  ROUTINES_SQL,
  FUNCTION_DEFINITION_SQL,
  MATERIALIZED_VIEW_DEFINITION_SQL,
  VIEW_DEFINITION_SQL,
}
