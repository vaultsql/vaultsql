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
  INDEXES_SQL,
  ROUTINES_SQL,
  SCHEMA_ASSETS_SQL,
  SCHEMA_COLUMNS_SQL,
  SCHEMA_NAMES_SQL,
  SHOW_CREATE_FUNCTION_SQL,
  SHOW_CREATE_PROCEDURE_SQL,
  VIEW_DEFINITION_SQL,
} from './sql'
import { escapeValue, quoteIdentifier } from './sqlUtils'

const mysqlAdapterFactory: DatabaseAdapterFactory = (runQuery: RunQueryFn) => ({
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
    // MySQL uses ? for placeholders, we need to replace it with the actual value
    const query = SCHEMA_ASSETS_SQL.replace('?', `'${schemaName}'`)
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
    const query = ROUTINES_SQL.replace('?', `'${schemaName}'`)
    const response = await runQuery(query, {
      actor: 'application',
      operation: 'schema_objects',
    })

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to load schema objects')
    }

    const rows = (response.result ?? []) as Record<string, unknown>[]
    const objects: SchemaObject[] = []

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

    return objects
  },

  async getObjectDefinition(schema: string, objectName: string, objectType) {
    if (objectType === 'materialized_view') {
      throw new Error('MySQL does not support materialized views')
    }

    // Build SHOW CREATE statement with proper identifier quoting
    const quotedSchema = quoteIdentifier(schema)
    const quotedName = quoteIdentifier(objectName)
    const baseCommand =
      objectType === 'procedure' ? SHOW_CREATE_PROCEDURE_SQL : SHOW_CREATE_FUNCTION_SQL
    const query = `${baseCommand} ${quotedSchema}.${quotedName}`

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

    // MySQL returns different column names for procedures vs functions
    const definitionKey = objectType === 'procedure' ? 'Create Procedure' : 'Create Function'
    const definition = getString(rows[0], definitionKey)
    if (!definition) {
      throw new Error(`Definition not found for ${schema}.${objectName}`)
    }

    return definition
  },

  async getViewDefinition(schema: string, viewName: string) {
    const query = VIEW_DEFINITION_SQL.replace('?', `'${schema}'`).replace('?', `'${viewName}'`)
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
    const columnsQuery = COLUMNS_SQL.replace('?', `'${schema}'`).replace('?', `'${table}'`)
    const indexesQuery = INDEXES_SQL.replace('?', `'${schema}'`).replace('?', `'${table}'`)
    const foreignKeysQuery = FOREIGN_KEYS_SQL.replace('?', `'${schema}'`).replace('?', `'${table}'`)

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
    const query = SCHEMA_COLUMNS_SQL.replace('?', `'${schemaName}'`)
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

export { mysqlAdapterFactory }
