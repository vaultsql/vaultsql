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
      return buildCreateIndexSql(schema, table, { ...idx, name: indexName }, false)
    })
    sql = sql + ';\n' + indexStatements.join(';\n')
  }

  return { sql, operation: 'create_table', schema, table }
}

function buildDropTableQuery(params: DropTableParams): DDLResult {
  const { schema, table, ifExists, cascade } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const ifExistsClause = ifExists ? 'IF EXISTS ' : ''
  const cascadeClause = cascade ? ' CASCADE' : ''
  const sql = `DROP TABLE ${ifExistsClause}${tableName}${cascadeClause}`

  return { sql, operation: 'drop_table', schema, table }
}

function buildTruncateTableQuery(params: TruncateTableParams): DDLResult {
  const { schema, table, cascade, restartIdentity } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const restartClause = restartIdentity ? ' RESTART IDENTITY' : ''
  const cascadeClause = cascade ? ' CASCADE' : ''
  const sql = `TRUNCATE TABLE ${tableName}${restartClause}${cascadeClause}`

  return { sql, operation: 'truncate_table', schema, table }
}

function buildRenameTableQuery(params: RenameTableParams): DDLResult {
  const { schema, table, newName } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const sql = `ALTER TABLE ${tableName} RENAME TO ${quoteIdentifier(newName)}`

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
  const { schema, table, column, cascade } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const cascadeClause = cascade ? ' CASCADE' : ''
  const sql = `ALTER TABLE ${tableName} DROP COLUMN ${quoteIdentifier(column)}${cascadeClause}`

  return { sql, operation: 'alter_table', schema, table }
}

function buildRenameColumnQuery(params: RenameColumnParams): DDLResult {
  const { schema, table, column, newName } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const sql = `ALTER TABLE ${tableName} RENAME COLUMN ${quoteIdentifier(column)} TO ${quoteIdentifier(newName)}`

  return { sql, operation: 'alter_table', schema, table }
}

function buildAlterColumnQuery(params: AlterColumnParams): DDLResult {
  const { schema, table, column, dataType, nullable, defaultValue } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
  const quotedColumn = quoteIdentifier(column)

  const alterParts: string[] = []

  if (dataType !== undefined) {
    alterParts.push(`ALTER COLUMN ${quotedColumn} SET DATA TYPE ${dataType}`)
  }

  if (nullable !== undefined) {
    if (nullable) {
      alterParts.push(`ALTER COLUMN ${quotedColumn} DROP NOT NULL`)
    } else {
      alterParts.push(`ALTER COLUMN ${quotedColumn} SET NOT NULL`)
    }
  }

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
  const { schema, table, index, ifNotExists } = params
  const indexName = index.name || generateIndexName(table, index.columns)
  const sql = buildCreateIndexSql(
    schema,
    table,
    { ...index, name: indexName },
    ifNotExists ?? false,
  )

  return { sql, operation: 'create_index', schema, table }
}

function buildDropIndexQuery(params: DropIndexParams): DDLResult {
  const { schema, indexName, ifExists, cascade, table } = params

  const ifExistsClause = ifExists ? 'IF EXISTS ' : ''
  const cascadeClause = cascade ? ' CASCADE' : ''
  const sql = `DROP INDEX ${ifExistsClause}${quoteIdentifier(schema)}.${quoteIdentifier(indexName)}${cascadeClause}`

  // PostgreSQL doesn't require table name for DROP INDEX, but we include it if provided
  return { sql, operation: 'drop_index', schema, table: table || '' }
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
  const { schema, table, constraintName, cascade } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const cascadeClause = cascade ? ' CASCADE' : ''
  const sql = `ALTER TABLE ${tableName} DROP CONSTRAINT ${quoteIdentifier(constraintName)}${cascadeClause}`

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
  ifNotExists: boolean,
): string {
  const uniqueClause = index.unique ? 'UNIQUE ' : ''
  const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : ''
  const indexType = index.type ? ` USING ${index.type}` : ''
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
  const indexName = quoteIdentifier(index.name)
  const columnList = index.columns.map((c) => quoteIdentifier(c)).join(', ')

  return `CREATE ${uniqueClause}INDEX ${ifNotExistsClause}${indexName} ON ${tableName}${indexType} (${columnList})`
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
