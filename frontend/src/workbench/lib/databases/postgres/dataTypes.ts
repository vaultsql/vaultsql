/**
 * Common PostgreSQL data types for column type selection.
 * Organized by category for easier browsing.
 */

export const POSTGRES_DATA_TYPES = [
  // Numeric types
  'integer',
  'bigint',
  'smallint',
  'serial',
  'bigserial',
  'numeric',
  'decimal',
  'real',
  'double precision',

  // Character types
  'text',
  'varchar(255)',
  'varchar(100)',
  'varchar(50)',
  'char(1)',

  // Boolean
  'boolean',

  // Date/Time types
  'timestamp',
  'timestamptz',
  'date',
  'time',
  'timetz',
  'interval',

  // JSON types
  'json',
  'jsonb',

  // Other common types
  'uuid',
  'bytea',
  'inet',
  'cidr',
  'macaddr',
] as const

export type PostgresDataType = (typeof POSTGRES_DATA_TYPES)[number]
