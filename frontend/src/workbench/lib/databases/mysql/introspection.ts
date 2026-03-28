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
    const columnType = getString(row, 'column_type') ?? getString(row, 'data_type') ?? 'unknown'
    const dataType = getString(row, 'data_type') ?? ''
    const extra = getString(row, 'extra') ?? ''
    const defaultValue = getString(row, 'column_default')

    const category = inferCategory(dataType, columnType)
    const isAutoIncrement = extra.toLowerCase().includes('auto_increment')
    const hasServerDefault =
      defaultValue !== null &&
      (defaultValue.toUpperCase().includes('CURRENT_TIMESTAMP') ||
        defaultValue.includes('(') ||
        defaultValue === '1' ||
        defaultValue === '0')
    const isGenerated = isAutoIncrement || extra.toLowerCase().includes('generated')

    return {
      name: getString(row, 'column_name') ?? '',
      dataType: columnType,
      nullable: getString(row, 'is_nullable') === 'YES',
      defaultValue,
      isPrimaryKey:
        row['is_primary_key'] === 1 ||
        row['is_primary_key'] === '1' ||
        getString(row, 'column_key') === 'PRI',
      comment: getString(row, 'column_comment'),
      category,
      hasServerDefault,
      isGenerated,
      isAutoIncrement,
    }
  })
}

function parseBulkColumn(row: Record<string, unknown>): ColumnInfo {
  const columnType = getString(row, 'column_type') ?? getString(row, 'data_type') ?? 'unknown'
  const dataType = getString(row, 'data_type') ?? ''
  const extra = getString(row, 'extra') ?? ''
  const defaultValue = getString(row, 'column_default')

  const category = inferCategory(dataType, columnType)
  const isAutoIncrement = extra.toLowerCase().includes('auto_increment')
  const hasServerDefault =
    defaultValue !== null &&
    (defaultValue.toUpperCase().includes('CURRENT_TIMESTAMP') ||
      defaultValue.includes('(') ||
      defaultValue === '1' ||
      defaultValue === '0')
  const isGenerated = isAutoIncrement || extra.toLowerCase().includes('generated')

  return {
    name: getString(row, 'column_name') ?? getString(row, 'columnName') ?? '',
    dataType: columnType,
    nullable: getString(row, 'is_nullable') === 'YES',
    defaultValue,
    isPrimaryKey: row['is_primary_key'] === 1 || row['is_primary_key'] === '1',
    comment: null, // Not available in bulk query
    category,
    hasServerDefault,
    isGenerated,
    isAutoIncrement,
  }
}

function inferCategory(dataType: string, columnType: string): ColumnCategory {
  const lower = dataType.toLowerCase()
  const lowerColumnType = columnType.toLowerCase()

  // Text types
  if (
    ['varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum', 'set'].includes(lower)
  ) {
    return 'text'
  }

  // Integer types
  if (['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'integer'].includes(lower)) {
    // TINYINT(1) is typically used for boolean
    if (lowerColumnType === 'tinyint(1)') {
      return 'boolean'
    }
    return 'integer'
  }

  // Float types
  if (['float', 'double', 'decimal', 'numeric', 'real'].includes(lower)) {
    return 'float'
  }

  // Boolean (MySQL doesn't have native boolean, uses TINYINT(1))
  if (lower === 'boolean' || lowerColumnType === 'tinyint(1)') {
    return 'boolean'
  }

  // Timestamp/Datetime types
  if (['timestamp', 'datetime'].includes(lower)) {
    return 'timestamp'
  }

  // Date
  if (lower === 'date') {
    return 'date'
  }

  // Time
  if (lower === 'time') {
    return 'time'
  }

  // JSON types
  if (lower === 'json') {
    return 'json'
  }

  // Binary types
  if (['blob', 'tinyblob', 'mediumblob', 'longblob', 'binary', 'varbinary'].includes(lower)) {
    return 'other'
  }

  return 'other'
}

function parseIndexes(rows: Record<string, unknown>[]): IndexInfo[] {
  return rows.map((row) => {
    const indexName = getString(row, 'index_name') ?? ''
    const columnsStr = getString(row, 'columns') ?? ''
    const columns = columnsStr ? columnsStr.split(',') : []

    return {
      name: indexName,
      columns,
      isUnique: !row['non_unique'],
      isPrimary: indexName === 'PRIMARY',
      type: getString(row, 'index_type')?.toLowerCase() ?? 'btree',
    }
  })
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
