import type {
  ColumnInfo,
  DatabaseAdapterFactory,
  FetchRowParams,
  RunQueryFn,
  SchemaObject,
  WorkbenchAsset,
} from '@/workbench/types/database'
import {
  buildAddColumnQuery,
  buildAddForeignKeyQuery,
  buildAlterColumnQuery,
  buildCreateIndexQuery,
  buildCreateTableQuery,
  buildDropColumnQuery,
  buildDropForeignKeyQuery,
  buildDropIndexQuery,
  buildDropTableQuery,
  buildRenameColumnQuery,
  buildRenameTableQuery,
  buildTruncateTableQuery,
} from './ddl'
import {
  getString,
  normalizeTableType,
  parseBulkColumn,
  parseColumns,
  parseForeignKeys,
  parseIndexes,
} from './introspection'
import { buildDeleteQuery, buildInsertQuery, buildUpdateQuery } from './mutations'
import { buildEstimatedCountQuery, buildExportQuery, buildTableQuery } from './queryBuilder'
import {
  COLUMNS_SQL,
  FOREIGN_KEYS_SQL,
  FUNCTION_DEFINITION_SQL,
  INDEXES_SQL,
  MATERIALIZED_VIEW_DEFINITION_SQL,
  MATERIALIZED_VIEWS_SQL,
  ROUTINES_SQL,
  SCHEMA_ASSETS_SQL,
  SCHEMA_COLUMNS_SQL,
  SCHEMA_NAMES_SQL,
  VIEW_DEFINITION_SQL,
} from './sql'
import { escapeValue, quoteIdentifier } from './sqlUtils'

const postgresAdapterFactory: DatabaseAdapterFactory = (runQuery: RunQueryFn) => ({
  async loadSchemaNames() {
    const response = await runQuery(SCHEMA_NAMES_SQL, {
      actor: 'application',
      operation: 'schema_names',
    })

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to load schema names')
    }

    const rows = (response.result ?? []) as Record<string, unknown>[]
    return rows
      .map((row) => getString(row, 'schema_name') ?? getString(row, 'schemaName'))
      .filter((name): name is string => name !== null)
  },

  async loadSchemaAssets(schemaName: string) {
    const query = SCHEMA_ASSETS_SQL.replace('$1', `'${schemaName}'`)
    const response = await runQuery(query, {
      actor: 'application',
      operation: 'schema_assets',
    })

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to load schema assets')
    }

    const rows = (response.result ?? []) as Record<string, unknown>[]
    return rows.map(
      (row): WorkbenchAsset => ({
        name: getString(row, 'table_name') ?? getString(row, 'tableName') ?? '',
        type: normalizeTableType(row['table_type'] ?? row['tableType']),
        schema: schemaName,
      }),
    )
  },

  async loadSchemaObjects(schemaName: string) {
    const matViewsQuery = MATERIALIZED_VIEWS_SQL.replace('$1', `'${schemaName}'`)
    const routinesQuery = ROUTINES_SQL.replace('$1', `'${schemaName}'`)

    const [matViewsResponse, routinesResponse] = await Promise.all([
      runQuery(matViewsQuery, {
        actor: 'application',
        operation: 'schema_objects',
      }),
      runQuery(routinesQuery, {
        actor: 'application',
        operation: 'schema_objects',
      }),
    ])

    const objects: SchemaObject[] = []

    // Add materialized views
    if (matViewsResponse.success) {
      const rows = (matViewsResponse.result ?? []) as Record<string, unknown>[]
      for (const row of rows) {
        objects.push({
          name: getString(row, 'object_name') ?? getString(row, 'objectName') ?? '',
          type: 'materialized_view',
          schema: schemaName,
        })
      }
    }

    // Add functions and procedures
    if (routinesResponse.success) {
      const rows = (routinesResponse.result ?? []) as Record<string, unknown>[]
      for (const row of rows) {
        const objectType = getString(row, 'object_type') ?? getString(row, 'objectType')
        if (objectType === 'function' || objectType === 'procedure') {
          objects.push({
            name: getString(row, 'object_name') ?? getString(row, 'objectName') ?? '',
            type: objectType,
            schema: schemaName,
          })
        }
      }
    }

    return objects
  },

  async getObjectDefinition(schema: string, objectName: string, objectType) {
    let query: string
    let definitionKey: string

    if (objectType === 'materialized_view') {
      query = MATERIALIZED_VIEW_DEFINITION_SQL.replace('$1', `'${schema}'`).replace(
        '$2',
        `'${objectName}'`,
      )
      definitionKey = 'definition'
    } else {
      // function or procedure
      query = FUNCTION_DEFINITION_SQL.replace('$1', `'${schema}'`).replace('$2', `'${objectName}'`)
      definitionKey = 'definition'
    }

    const response = await runQuery(query, {
      actor: 'application',
      operation: 'object_definition',
    })

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to get object definition')
    }

    const rows = (response.result ?? []) as Record<string, unknown>[]
    if (rows.length === 0) {
      throw new Error(`Object not found: ${schema}.${objectName}`)
    }

    const definition = getString(rows[0], definitionKey)
    if (!definition) {
      throw new Error(`Definition not found for ${schema}.${objectName}`)
    }

    // For materialized views, we need to add the CREATE MATERIALIZED VIEW prefix
    if (objectType === 'materialized_view') {
      return `CREATE MATERIALIZED VIEW ${schema}.${objectName} AS\n${definition}`
    }

    return definition
  },

  async getViewDefinition(schema: string, viewName: string) {
    const query = VIEW_DEFINITION_SQL.replace('$1', schema).replace('$2', viewName)
    const response = await runQuery(query, {
      actor: 'application',
      operation: 'view_definition',
    })

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to get view definition')
    }

    const rows = (response.result ?? []) as Record<string, unknown>[]
    if (rows.length === 0) {
      throw new Error(`View not found: ${schema}.${viewName}`)
    }

    const definition =
      getString(rows[0], 'create_statement') ?? getString(rows[0], 'createStatement')
    if (!definition) {
      throw new Error(`Definition not found for view ${schema}.${viewName}`)
    }

    return `CREATE OR REPLACE VIEW ${quoteIdentifier(schema)}.${quoteIdentifier(viewName)} AS\n${definition}`
  },

  async describeTable(schema: string, table: string) {
    const columnsQuery = COLUMNS_SQL.replace('$1', `'${schema}'`).replace('$2', `'${table}'`)
    const indexesQuery = INDEXES_SQL.replace('$1', `'${schema}'`).replace('$2', `'${table}'`)
    const foreignKeysQuery = FOREIGN_KEYS_SQL.replace('$1', `'${schema}'`).replace(
      '$2',
      `'${table}'`,
    )

    const [columnsResponse, indexesResponse, foreignKeysResponse] = await Promise.all([
      runQuery(columnsQuery, {
        actor: 'application',
        operation: 'describe_table_columns',
      }),
      runQuery(indexesQuery, {
        actor: 'application',
        operation: 'describe_table_indexes',
      }),
      runQuery(foreignKeysQuery, {
        actor: 'application',
        operation: 'describe_table_foreign_keys',
      }),
    ])

    if (!columnsResponse.success) {
      throw new Error(columnsResponse.error ?? 'Failed to load columns')
    }

    const columns = parseColumns(columnsResponse.result as Record<string, unknown>[])
    const indexes = indexesResponse.success
      ? parseIndexes(indexesResponse.result as Record<string, unknown>[])
      : []
    const foreignKeys = foreignKeysResponse.success
      ? parseForeignKeys((foreignKeysResponse.result ?? []) as Record<string, unknown>[])
      : []

    return { columns, indexes, foreignKeys }
  },

  async loadAllColumns(schemaName: string) {
    const query = SCHEMA_COLUMNS_SQL.replace('$1', `'${schemaName}'`)
    const response = await runQuery(query, {
      actor: 'application',
      operation: 'schema_columns',
    })

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to load schema columns')
    }

    const rows = (response.result ?? []) as Record<string, unknown>[]
    const columnsMap = new Map<string, ColumnInfo[]>()

    for (const row of rows) {
      const schema = getString(row, 'table_schema') ?? getString(row, 'tableSchema') ?? ''
      const table = getString(row, 'table_name') ?? getString(row, 'tableName') ?? ''
      const key = `${schema}.${table}`

      const column = parseBulkColumn(row)

      const existing = columnsMap.get(key)
      if (existing) {
        existing.push(column)
      } else {
        columnsMap.set(key, [column])
      }
    }

    return columnsMap
  },

  async fetchRow({ schema, table, column, value }: FetchRowParams) {
    const escapedValue = typeof value === 'string' ? escapeValue(value) : value
    const query = `SELECT * FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)} WHERE ${quoteIdentifier(column)} = ${escapedValue} LIMIT 1`
    const response = await runQuery(query, {
      actor: 'application',
      operation: 'fetch_row',
    })

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to fetch row')
    }

    const rows = (response.result ?? []) as Record<string, unknown>[]
    return rows[0] ?? null
  },

  buildTableQuery,
  buildExportQuery,
  buildEstimatedCountQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildDeleteQuery,

  // ============ DDL Query Builders ============

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
})

export { postgresAdapterFactory }
