import type { WorkbenchTableType } from '@/workbench/features/schema-browser/useSchemasStore'
import type {
  ColumnCategory,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
} from '@/workbench/types/database'

function normalizeTableType(value: unknown): WorkbenchTableType {
  if (typeof value !== 'string') {
    return 'table'
  }

  const normalized = value.toUpperCase()
  if (normalized === 'VIEW') {
    return 'view'
  }

  return 'table'
}

function getString(source: Record<string, unknown>, key: string) {
  const value = source[key]
  return typeof value === 'string' ? value : null
}

function parseColumns(rows: Record<string, unknown>[]): ColumnInfo[] {
  return rows.map((row) => {
    const dataType = formatDataType(row)
    const udtName = getString(row, 'udt_name') ?? ''
    const defaultValue = getString(row, 'column_default')

    const category = inferCategory(udtName)
    const isAutoIncrement = defaultValue?.includes('nextval(') ?? false
    const hasServerDefault =
      defaultValue !== null &&
      (defaultValue.includes('(') || // function calls like NOW(), nextval()
        defaultValue.startsWith('CURRENT_') ||
        defaultValue === 'true' ||
        defaultValue === 'false')
    const isGenerated = isAutoIncrement || (defaultValue?.includes('generated') ?? false)

    return {
      name: getString(row, 'column_name') ?? '',
      dataType,
      nullable: getString(row, 'is_nullable') === 'YES',
      defaultValue,
      isPrimaryKey: Boolean(row['is_primary_key']),
      comment: getString(row, 'column_comment'),
      category,
      hasServerDefault,
      isGenerated,
      isAutoIncrement,
    }
  })
}

function parseBulkColumn(row: Record<string, unknown>): ColumnInfo {
  const dataType = formatDataType(row)
  const udtName = getString(row, 'udt_name') ?? ''
  const defaultValue = getString(row, 'column_default')

  const category = inferCategory(udtName)
  const isAutoIncrement = defaultValue?.includes('nextval(') ?? false
  const hasServerDefault =
    defaultValue !== null &&
    (defaultValue.includes('(') ||
      defaultValue.startsWith('CURRENT_') ||
      defaultValue === 'true' ||
      defaultValue === 'false')
  const isGenerated = isAutoIncrement || (defaultValue?.includes('generated') ?? false)

  return {
    name: getString(row, 'column_name') ?? getString(row, 'columnName') ?? '',
    dataType,
    nullable: getString(row, 'is_nullable') === 'YES',
    defaultValue,
    isPrimaryKey: Boolean(row['is_primary_key']),
    comment: null, // Not available in bulk query
    category,
    hasServerDefault,
    isGenerated,
    isAutoIncrement,
  }
}

function inferCategory(udtName: string): ColumnCategory {
  const lower = udtName.toLowerCase()

  // Text types
  if (['text', 'varchar', 'char', 'bpchar', 'name', 'citext'].includes(lower)) {
    return 'text'
  }

  // Integer types
  if (
    [
      'int2',
      'int4',
      'int8',
      'smallint',
      'integer',
      'bigint',
      'serial',
      'bigserial',
      'smallserial',
    ].includes(lower)
  ) {
    return 'integer'
  }

  // Float types
  if (
    ['float4', 'float8', 'real', 'double precision', 'numeric', 'decimal', 'money'].includes(lower)
  ) {
    return 'float'
  }

  // Boolean
  if (lower === 'bool' || lower === 'boolean') {
    return 'boolean'
  }

  // Timestamp types
  if (
    [
      'timestamp',
      'timestamptz',
      'timestamp with time zone',
      'timestamp without time zone',
    ].includes(lower)
  ) {
    return 'timestamp'
  }

  // Date
  if (lower === 'date') {
    return 'date'
  }

  // Time
  if (['time', 'timetz', 'time with time zone', 'time without time zone'].includes(lower)) {
    return 'time'
  }

  // UUID
  if (lower === 'uuid') {
    return 'uuid'
  }

  // JSON types
  if (['json', 'jsonb'].includes(lower)) {
    return 'json'
  }

  // Array types (postgres uses _ prefix for array types)
  if (lower.startsWith('_')) {
    return 'array'
  }

  return 'other'
}

function formatDataType(row: Record<string, unknown>): string {
  const udtName = getString(row, 'udt_name') ?? getString(row, 'data_type') ?? 'unknown'
  const charLength = row['character_maximum_length']
  const numericPrecision = row['numeric_precision']
  const numericScale = row['numeric_scale']

  // Handle common postgres types with their lengths/precision
  if (charLength !== null && charLength !== undefined) {
    return `${udtName}(${charLength})`
  }
  if (
    numericPrecision !== null &&
    numericPrecision !== undefined &&
    numericScale !== null &&
    numericScale !== undefined
  ) {
    return `${udtName}(${numericPrecision},${numericScale})`
  }

  return udtName
}

function parseIndexes(rows: Record<string, unknown>[]): IndexInfo[] {
  return rows.map((row) => ({
    name: getString(row, 'index_name') ?? '',
    columns: Array.isArray(row['columns']) ? (row['columns'] as string[]) : [],
    isUnique: Boolean(row['is_unique']),
    isPrimary: Boolean(row['is_primary']),
    type: getString(row, 'index_type') ?? 'btree',
  }))
}

function parseForeignKeys(rows: Record<string, unknown>[]): ForeignKeyInfo[] {
  return rows.map((row) => ({
    constraintName: getString(row, 'constraint_name') ?? '',
    column: getString(row, 'fk_column') ?? '',
    refSchema: getString(row, 'ref_schema') ?? '',
    refTable: getString(row, 'ref_table') ?? '',
    refColumn: getString(row, 'ref_column') ?? '',
    onUpdate: getString(row, 'on_update') ?? 'NO ACTION',
    onDelete: getString(row, 'on_delete') ?? 'NO ACTION',
  }))
}

export {
  normalizeTableType,
  getString,
  parseColumns,
  parseBulkColumn,
  parseIndexes,
  parseForeignKeys,
}
