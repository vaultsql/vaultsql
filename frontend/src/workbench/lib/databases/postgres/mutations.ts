import type {
  DeleteParams,
  InsertParams,
  MutationResult,
  UpdateParams,
} from '@/workbench/types/database'
import { escapeValue, quoteIdentifier } from './sqlUtils'

function buildInsertQuery(params: InsertParams): MutationResult {
  const { schema, table, values } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const columns: string[] = []
  const sqlValues: string[] = []

  for (const col of values) {
    if (col.useDefault) continue
    columns.push(quoteIdentifier(col.column))
    sqlValues.push(formatMutationValue(col.value, col.isNull))
  }

  const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${sqlValues.join(', ')})`

  return { sql, operation: 'insert', table, schema }
}

function buildUpdateQuery(params: UpdateParams): MutationResult {
  const { schema, table, values, primaryKey } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const setParts: string[] = []
  for (const col of values) {
    if (col.useDefault) continue
    const colName = quoteIdentifier(col.column)
    const colValue = formatMutationValue(col.value, col.isNull)
    setParts.push(`${colName} = ${colValue}`)
  }

  const whereClause = `${quoteIdentifier(primaryKey.column)} = ${formatMutationValue(primaryKey.value, false)}`
  const sql = `UPDATE ${tableName} SET ${setParts.join(', ')} WHERE ${whereClause}`

  return { sql, operation: 'update', table, schema }
}

function buildDeleteQuery(params: DeleteParams): MutationResult {
  const { schema, table, primaryKey } = params
  const tableName = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  const whereClause = `${quoteIdentifier(primaryKey.column)} = ${formatMutationValue(primaryKey.value, false)}`
  const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`

  return { sql, operation: 'delete', table, schema }
}

function formatMutationValue(value: unknown, isNull?: boolean): string {
  if (isNull || value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'string') {
    return escapeValue(value)
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }
  // Fallback: convert to string and escape
  return escapeValue(String(value))
}

export { buildInsertQuery, buildUpdateQuery, buildDeleteQuery }
