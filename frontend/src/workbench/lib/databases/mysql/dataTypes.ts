/**
 * Common MySQL data types for column type selection.
 * Organized by category for easier browsing.
 */

export const MYSQL_DATA_TYPES = [
  // Numeric types
  'INT',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'MEDIUMINT',
  'DECIMAL(10,2)',
  'NUMERIC(10,2)',
  'FLOAT',
  'DOUBLE',

  // Character types
  'TEXT',
  'VARCHAR(255)',
  'VARCHAR(100)',
  'VARCHAR(50)',
  'CHAR(1)',
  'MEDIUMTEXT',
  'LONGTEXT',
  'TINYTEXT',

  // Boolean
  'BOOLEAN',
  'TINYINT(1)',

  // Date/Time types
  'DATETIME',
  'TIMESTAMP',
  'DATE',
  'TIME',
  'YEAR',

  // JSON type
  'JSON',

  // Binary types
  'BLOB',
  'MEDIUMBLOB',
  'LONGBLOB',
  'BINARY',
  'VARBINARY(255)',

  // Other common types
  'ENUM',
  'SET',
] as const

export type MySQLDataType = (typeof MYSQL_DATA_TYPES)[number]
