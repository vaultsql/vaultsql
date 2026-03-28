import type {
  EstimatedCountParams,
  EstimatedCountResult,
  ExportQueryParams,
  ExportQueryResult,
  FilterInput,
  TableQueryParams,
  TableQueryResult,
} from '@/workbench/types/database'
import { escapeValue, quoteIdentifier } from './sqlUtils'

function buildTableQuery(params: TableQueryParams): TableQueryResult {
  const { schema, table, columns, filters, rawWhere, filterMode = 'all', sort, limit, offset } = params

  // Build SELECT clause
  const selectClause =
    columns && columns.length > 0 ? columns.map((col) => quoteIdentifier(col)).join(', ') : '*'

  // Build FROM clause
  const fromClause = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`

  // Build WHERE clause (combine both structured filters and raw SQL)
  const whereClause = buildWhereClause(filters, rawWhere, filterMode)

  // Build ORDER BY clause
  const orderByClause = buildOrderByClause(sort)

  // Build LIMIT/OFFSET clause
  const limitOffsetClause = buildLimitOffsetClause(limit, offset)

  // Assemble the full query
  const sql = [
    `SELECT ${selectClause}`,
    `FROM ${fromClause}`,
    whereClause,
    orderByClause,
    limitOffsetClause,
  ]
    .filter(Boolean)
    .join('\n')

  // Build count query (for pagination)
  const countSql = ['SELECT COUNT(*) as total', `FROM ${fromClause}`, whereClause]
    .filter(Boolean)
    .join('\n')

  return { sql, countSql }
}

function buildExportQuery(params: ExportQueryParams): ExportQueryResult {
  const { sql } = buildTableQuery(params)
  return { sql }
}

function buildEstimatedCountQuery(params: EstimatedCountParams): EstimatedCountResult {
  const { schema, table, filters } = params

  const fromClause = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
  const whereClause = buildWhereClause(filters, undefined, 'all')

  // Fast estimated count using pg_class statistics
  // This works for tables and materialized views
  const sql = `
SELECT reltuples::int8 as count
FROM pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = ${escapeValue(schema)}
  AND c.relname = ${escapeValue(table)}
`.trim()

  // Fallback to accurate COUNT(*) if estimate fails or filters are present
  // For views or if the estimate returns null/0
  const fallbackSql = ['SELECT COUNT(*) as count', `FROM ${fromClause}`, whereClause]
    .filter(Boolean)
    .join('\n')

  return { sql, fallbackSql }
}

function buildWhereClause(filters?: FilterInput[], rawWhere?: string, filterMode: 'all' | 'any' = 'all'): string {
  const conditions: string[] = []

  // Add structured filter conditions
  if (filters && filters.length > 0) {
    const filterConditions = filters.map((filter) => buildFilterCondition(filter))
    // If we have multiple filters, group them with the appropriate operator
    if (filterConditions.length > 1) {
      const joiner = filterMode === 'any' ? ' OR ' : ' AND '
      conditions.push(`(${filterConditions.join(joiner)})`)
    } else {
      conditions.push(...filterConditions)
    }
  }

  // Add raw SQL condition
  if (rawWhere) {
    conditions.push(`(${rawWhere})`)
  }

  if (conditions.length === 0) {
    return ''
  }

  return `WHERE ${conditions.join(' AND ')}`
}

function buildFilterCondition(filter: FilterInput): string {
  const quotedColumn = quoteIdentifier(filter.column)
  const value = filter.value

  switch (filter.operator) {
    case 'eq':
      return `${quotedColumn} = ${escapeValue(value)}`
    case 'neq':
      return `${quotedColumn} != ${escapeValue(value)}`
    case 'gt':
      return `${quotedColumn} > ${escapeValue(value)}`
    case 'gte':
      return `${quotedColumn} >= ${escapeValue(value)}`
    case 'lt':
      return `${quotedColumn} < ${escapeValue(value)}`
    case 'lte':
      return `${quotedColumn} <= ${escapeValue(value)}`
    case 'contains':
      return `${quotedColumn} LIKE ${escapeLikeValue(value)}`
    case 'icontains':
      return `${quotedColumn} ILIKE ${escapeLikeValue(value)}`
    case 'startsWith':
      return `${quotedColumn} LIKE ${escapeValue(`${value.replace(/'/g, "''")}%`)}`
    case 'endsWith':
      return `${quotedColumn} LIKE ${escapeValue(`%${value.replace(/'/g, "''")}`)}`
    case 'isNull':
      return `${quotedColumn} IS NULL`
    case 'isNotNull':
      return `${quotedColumn} IS NOT NULL`
    case 'in':
      return `${quotedColumn} IN (${formatInValues(value)})`
    default:
      return `${quotedColumn} = ${escapeValue(value)}`
  }
}

function escapeLikeValue(value: string): string {
  // If user hasn't added wildcards, wrap with %
  const hasWildcard = value.includes('%') || value.includes('_')
  const pattern = hasWildcard ? value : `%${value}%`
  return escapeValue(pattern)
}

function formatInValues(value: string): string {
  const values = value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => escapeValue(v))
    .join(', ')
  return values || 'NULL'
}

function buildOrderByClause(sort?: { column: string; direction: 'asc' | 'desc' }[]): string {
  if (!sort || sort.length === 0) {
    return ''
  }

  const orderParts = sort.map(({ column, direction }) => {
    const quotedColumn = quoteIdentifier(column)
    const dir = direction.toUpperCase()
    return `${quotedColumn} ${dir}`
  })

  return `ORDER BY ${orderParts.join(', ')}`
}

function buildLimitOffsetClause(limit?: number, offset?: number): string {
  const parts: string[] = []

  if (limit !== undefined && limit > 0) {
    parts.push(`LIMIT ${Math.floor(limit)}`)
  }

  if (offset !== undefined && offset > 0) {
    parts.push(`OFFSET ${Math.floor(offset)}`)
  }

  return parts.join(' ')
}

export { buildEstimatedCountQuery, buildExportQuery, buildTableQuery }
