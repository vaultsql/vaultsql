import type {
  AddColumnParams,
  AddForeignKeyParams,
  AlterColumnParams,
  ColumnDefinition,
  CreateIndexParams,
  CreateTableParams,
  DDLResult,
  DropColumnParams,
  DropForeignKeyParams,
  DropIndexParams,
  DropTableParams,
  IndexDefinition,
  RenameColumnParams,
  RenameTableParams,
  TruncateTableParams,
} from '@/workbench/types/database'
import { quoteIdentifier } from './sqlUtils'

function buildCreateTableQuery(params: CreateTableParams): DDLResult {
  const { schema, table, columns, indexes, ifNotExists } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const columnDefs = columns.map((col) => buildColumnDefinition(col))

  // Collect primary keys for composite PRIMARY KEY constraint
  const primaryKeyCols = columns.filter((c) => c.primaryKey).map((c) => quoteIdentifier(c.name))
  if (primaryKeyCols.length > 1) {
    columnDefs.push(`PRIMARY KEY (${primaryKeyCols.join(', ')})`)
  }

  const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : ''
  let sql = `CREATE TABLE ${ifNotExistsClause}${tableName} (\n  ${columnDefs.join(',\n  ')}\n)`

  // Add CREATE INDEX statements for any indexes
  if (indexes && indexes.length > 0) {
    const indexStatements = indexes.map((idx) => {
      const indexName = idx.name || generateIndexName(table, idx.columns)
      return buildCreateIndexSql(schema, table, { ...idx, name: indexName })
    })
    sql = sql + ';\n' + indexStatements.join(';\n')
  }

  return { sql, operation: 'create_table', schema, table }
}

function buildDropTableQuery(params: DropTableParams): DDLResult {
  const { schema, table, ifExists } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const ifExistsClause = ifExists ? 'IF EXISTS ' : ''
  // MySQL doesn't support CASCADE for DROP TABLE in the same way as PostgreSQL
  const sql = `DROP TABLE ${ifExistsClause}${tableName}`

  return { sql, operation: 'drop_table', schema, table }
}

function buildTruncateTableQuery(params: TruncateTableParams): DDLResult {
  const { schema, table } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  // MySQL TRUNCATE doesn't support RESTART IDENTITY or CASCADE
  const sql = `TRUNCATE TABLE ${tableName}`

  return { sql, operation: 'truncate_table', schema, table }
}

function buildRenameTableQuery(params: RenameTableParams): DDLResult {
  const { schema, table, newName } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
  const newTableName = `${quoteIdentifier(schema)}.${quoteIdentifier(newName)}`

  // MySQL uses RENAME TABLE syntax
  const sql = `RENAME TABLE ${tableName} TO ${newTableName}`

  return { sql, operation: 'alter_table', schema, table }
}

function buildAddColumnQuery(params: AddColumnParams): DDLResult {
  const { schema, table, column } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const columnDef = buildColumnDefinition(column)
  const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`

  return { sql, operation: 'alter_table', schema, table }
}

function buildDropColumnQuery(params: DropColumnParams): DDLResult {
  const { schema, table, column } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  // MySQL doesn't support CASCADE for DROP COLUMN
  const sql = `ALTER TABLE ${tableName} DROP COLUMN ${quoteIdentifier(column)}`

  return { sql, operation: 'alter_table', schema, table }
}

function buildRenameColumnQuery(params: RenameColumnParams): DDLResult {
  const { schema, table, column, newName } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  // MySQL 8.0+ supports RENAME COLUMN
  const sql = `ALTER TABLE ${tableName} RENAME COLUMN ${quoteIdentifier(column)} TO ${quoteIdentifier(newName)}`

  return { sql, operation: 'alter_table', schema, table }
}

function buildAlterColumnQuery(params: AlterColumnParams): DDLResult {
  const { schema, table, column, dataType, nullable, defaultValue } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
  const quotedColumn = quoteIdentifier(column)

  // MySQL requires different syntax for modifying columns
  // We need to use MODIFY COLUMN which requires the full column definition
  const alterParts: string[] = []

  // For dataType or nullable changes, we use MODIFY COLUMN
  if (dataType !== undefined || nullable !== undefined) {
    const type = dataType ?? 'VARCHAR(255)' // fallback type
    const nullClause = nullable === false ? ' NOT NULL' : ''
    alterParts.push(`MODIFY COLUMN ${quotedColumn} ${type}${nullClause}`)
  }

  // Default value changes
  if (defaultValue !== undefined) {
    if (defaultValue === null) {
      alterParts.push(`ALTER COLUMN ${quotedColumn} DROP DEFAULT`)
    } else {
      alterParts.push(`ALTER COLUMN ${quotedColumn} SET DEFAULT ${defaultValue}`)
    }
  }

  const sql = `ALTER TABLE ${tableName} ${alterParts.join(', ')}`

  return { sql, operation: 'alter_table', schema, table }
}

function buildCreateIndexQuery(params: CreateIndexParams): DDLResult {
  const { schema, table, index } = params
  const indexName = index.name || generateIndexName(table, index.columns)
  const sql = buildCreateIndexSql(schema, table, { ...index, name: indexName })

  return { sql, operation: 'create_index', schema, table }
}

function buildDropIndexQuery(params: DropIndexParams): DDLResult {
  const { schema, indexName, table } = params

  // MySQL requires table name for DROP INDEX
  if (!table) {
    throw new Error('Table name is required for DROP INDEX in MySQL')
  }

  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  // MySQL doesn't support IF EXISTS for DROP INDEX (before 5.7.4)
  // and doesn't support CASCADE
  const sql = `DROP INDEX ${quoteIdentifier(indexName)} ON ${tableName}`

  return { sql, operation: 'drop_index', schema, table }
}

function buildAddForeignKeyQuery(params: AddForeignKeyParams): DDLResult {
  const {
    schema,
    table,
    column,
    constraintName,
    refSchema,
    refTable,
    refColumn,
    onDelete,
    onUpdate,
  } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
  const refTableName = `${quoteIdentifier(refSchema)}.${quoteIdentifier(refTable)}`

  const fkName = constraintName || generateForeignKeyName(table, column)

  let sql = `ALTER TABLE ${tableName} ADD CONSTRAINT ${quoteIdentifier(fkName)} FOREIGN KEY (${quoteIdentifier(column)}) REFERENCES ${refTableName}(${quoteIdentifier(refColumn)})`

  if (onDelete) {
    sql += ` ON DELETE ${onDelete}`
  }
  if (onUpdate) {
    sql += ` ON UPDATE ${onUpdate}`
  }

  return { sql, operation: 'alter_table', schema, table }
}

function buildDropForeignKeyQuery(params: DropForeignKeyParams): DDLResult {
  const { schema, table, constraintName } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  // MySQL uses DROP FOREIGN KEY (not DROP CONSTRAINT)
  const sql = `ALTER TABLE ${tableName} DROP FOREIGN KEY ${quoteIdentifier(constraintName)}`

  return { sql, operation: 'alter_table', schema, table }
}

function generateForeignKeyName(table: string, column: string): string {
  const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '_')
  const sanitizedColumn = column.replace(/[^a-zA-Z0-9_]/g, '_')
  return `fk_${sanitizedTable}_${sanitizedColumn}`
}

function buildColumnDefinition(col: ColumnDefinition): string {
  const parts: string[] = [quoteIdentifier(col.name), col.dataType]

  // Only add PRIMARY KEY inline for single-column primary keys
  if (col.primaryKey) {
    parts.push('PRIMARY KEY')
  }

  if (col.unique) {
    parts.push('UNIQUE')
  }

  if (col.nullable === false) {
    parts.push('NOT NULL')
  }

  if (col.defaultValue !== undefined && col.defaultValue !== null) {
    parts.push(`DEFAULT ${col.defaultValue}`)
  }

  if (col.references) {
    const refTable = `${quoteIdentifier(col.references.schema)}.${quoteIdentifier(col.references.table)}`
    let refClause = `REFERENCES ${refTable}(${quoteIdentifier(col.references.column)})`
    if (col.references.onDelete) {
      refClause += ` ON DELETE ${col.references.onDelete}`
    }
    if (col.references.onUpdate) {
      refClause += ` ON UPDATE ${col.references.onUpdate}`
    }
    parts.push(refClause)
  }

  if (col.check) {
    parts.push(`CHECK (${col.check})`)
  }

  return parts.join(' ')
}

function generateIndexName(table: string, columns: string[]): string {
  const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '_')
  const sanitizedCols = columns.map((c) => c.replace(/[^a-zA-Z0-9_]/g, '_')).join('_')
  return `idx_${sanitizedTable}_${sanitizedCols}`
}

function buildCreateIndexSql(
  schema: string,
  table: string,
  index: IndexDefinition & { name: string },
): string {
  const uniqueClause = index.unique ? 'UNIQUE ' : ''
  // MySQL doesn't support IF NOT EXISTS for CREATE INDEX before 5.7.4
  const ifNotExistsClause = ''
  const indexType = index.type ? ` USING ${index.type.toUpperCase()}` : ''
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
  const indexName = quoteIdentifier(index.name)
  const columnList = index.columns.map((c) => quoteIdentifier(c)).join(', ')

  return `CREATE ${uniqueClause}INDEX ${ifNotExistsClause}${indexName} ON ${tableName} (${columnList})${indexType}`
}

export {
  buildCreateTableQuery,
  buildDropTableQuery,
  buildTruncateTableQuery,
  buildRenameTableQuery,
  buildAddColumnQuery,
  buildDropColumnQuery,
  buildRenameColumnQuery,
  buildAlterColumnQuery,
  buildCreateIndexQuery,
  buildDropIndexQuery,
  buildAddForeignKeyQuery,
  buildDropForeignKeyQuery,
}
