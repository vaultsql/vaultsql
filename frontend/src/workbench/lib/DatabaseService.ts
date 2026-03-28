import type {
  AddColumnParams,
  AddForeignKeyParams,
  AlterColumnParams,
  ColumnInfo,
  CreateIndexParams,
  CreateTableParams,
  DatabaseAdapter,
  DatabaseInfo,
  DDLResult,
  DeleteParams,
  DropColumnParams,
  DropForeignKeyParams,
  DropIndexParams,
  DropTableParams,
  EstimatedCountParams,
  EstimatedCountResult,
  ExportQueryParams,
  ExportQueryResult,
  FetchRowParams,
  InsertParams,
  MutationResult,
  QueryAudit,
  QueryResponse,
  RenameColumnParams,
  RenameTableParams,
  RunQueryFn,
  SchemaObject,
  StreamQueryFn,
  StreamQueryHandlers,
  TableQueryParams,
  TableQueryResult,
  TableStructure,
  TruncateTableParams,
  UpdateParams,
  WorkbenchAsset,
} from '@/workbench/types/database'
import { getDatabaseAdapterFactory } from './databases'

export class DatabaseService {
  private runQueryFn: RunQueryFn
  private streamQueryFn?: StreamQueryFn
  private database: DatabaseInfo
  private adapter: DatabaseAdapter

  constructor(runQuery: RunQueryFn, database: DatabaseInfo, streamQuery?: StreamQueryFn) {
    this.runQueryFn = runQuery
    this.streamQueryFn = streamQuery
    this.database = database

    const factory = getDatabaseAdapterFactory(database.type)
    if (!factory) {
      throw new Error(`Unsupported database type: ${database.type}`)
    }
    this.adapter = factory(runQuery, database)
  }

  get type() {
    return this.database.type
  }

  /**
   * @deprecated Do not use - callers should manage the active schema explicitly.
   * This will be removed in a future version.
   */
  get schema() {
    return this.database.schema
  }

  get name() {
    return this.database.name
  }

  /**
   * Execute a raw SQL query
   */
  async query(sql: string, audit?: QueryAudit): Promise<QueryResponse> {
    return this.runQueryFn(sql, audit)
  }

  /**
   * Execute a SQL query with streaming updates when supported.
   */
  async streamQuery(
    sql: string,
    handlers?: StreamQueryHandlers,
    audit?: QueryAudit,
  ): Promise<QueryResponse> {
    if (this.streamQueryFn) {
      return this.streamQueryFn(sql, handlers, audit)
    }

    const response = await this.runQueryFn(sql, audit)
    if (response.success) {
      handlers?.onColumns?.(response.columns ?? [])
      if (Array.isArray(response.result)) {
        response.result.forEach((row) => handlers?.onRow?.(row as Record<string, unknown>))
      }
      handlers?.onComplete?.({
        rowCount: response.result?.length ?? 0,
        truncated: false,
      })
    } else {
      handlers?.onError?.(response.error ?? 'Failed to run query')
    }
    return response
  }

  /**
   * Load all schema names from the database
   */
  async loadSchemaNames(): Promise<string[]> {
    return this.adapter.loadSchemaNames()
  }

  /**
   * Load tables and views for a schema
   */
  async loadSchemaAssets(schemaName: string): Promise<WorkbenchAsset[]> {
    return this.adapter.loadSchemaAssets(schemaName)
  }

  /**
   * Load schema objects (materialized views, functions, procedures)
   */
  async loadSchemaObjects(schemaName: string): Promise<SchemaObject[]> {
    if (!this.adapter.loadSchemaObjects) {
      return []
    }
    return this.adapter.loadSchemaObjects(schemaName)
  }

  /**
   * Get the CREATE statement for a schema object (function, procedure, materialized view)
   */
  async getObjectDefinition(
    schema: string,
    objectName: string,
    objectType: SchemaObject['type'],
  ): Promise<string> {
    if (!this.adapter.getObjectDefinition) {
      throw new Error('getObjectDefinition is not supported by this adapter')
    }
    return this.adapter.getObjectDefinition(schema, objectName, objectType)
  }

  /**
   * Get the CREATE statement for a view
   */
  async getViewDefinition(schema: string, viewName: string): Promise<string> {
    if (!this.adapter.getViewDefinition) {
      throw new Error('getViewDefinition is not supported by this adapter')
    }
    return this.adapter.getViewDefinition(schema, viewName)
  }

  /**
   * Get table structure (columns and indexes)
   */
  async describeTable(schema: string, table: string): Promise<TableStructure> {
    return this.adapter.describeTable(schema, table)
  }

  /**
   * Bulk load all columns for a schema (for autocomplete)
   */
  async loadAllColumns(schemaName: string): Promise<Map<string, ColumnInfo[]>> {
    if (!this.adapter.loadAllColumns) {
      return new Map()
    }
    return this.adapter.loadAllColumns(schemaName)
  }

  /**
   * Fetch a single row by column value (e.g., for FK lookups)
   */
  async fetchRow(params: FetchRowParams): Promise<Record<string, unknown> | null> {
    return this.adapter.fetchRow(params)
  }

  /**
   * Build a table query with filters, sorting, pagination, and column selection
   */
  buildTableQuery(params: TableQueryParams): TableQueryResult {
    return this.adapter.buildTableQuery(params)
  }

  /**
   * Build an export query with filters, sorting, pagination, and column selection
   */
  buildExportQuery(params: ExportQueryParams): ExportQueryResult {
    return this.adapter.buildExportQuery(params)
  }

  /**
   * Build an estimated count query (fast approximate count for pagination)
   */
  buildEstimatedCountQuery(params: EstimatedCountParams): EstimatedCountResult {
    return this.adapter.buildEstimatedCountQuery(params)
  }

  /**
   * Build an INSERT query (returns SQL only, does not execute)
   */
  buildInsertQuery(params: InsertParams): MutationResult {
    return this.adapter.buildInsertQuery(params)
  }

  /**
   * Build an UPDATE query (returns SQL only, does not execute)
   */
  buildUpdateQuery(params: UpdateParams): MutationResult {
    return this.adapter.buildUpdateQuery(params)
  }

  /**
   * Build a DELETE query (returns SQL only, does not execute)
   */
  buildDeleteQuery(params: DeleteParams): MutationResult {
    return this.adapter.buildDeleteQuery(params)
  }

  // ============ DDL Query Builders ============

  /**
   * Build a CREATE TABLE query (returns SQL only, does not execute)
   */
  buildCreateTableQuery(params: CreateTableParams): DDLResult {
    return this.adapter.buildCreateTableQuery(params)
  }

  /**
   * Build a DROP TABLE query (returns SQL only, does not execute)
   */
  buildDropTableQuery(params: DropTableParams): DDLResult {
    return this.adapter.buildDropTableQuery(params)
  }

  /**
   * Build a TRUNCATE TABLE query (returns SQL only, does not execute)
   */
  buildTruncateTableQuery(params: TruncateTableParams): DDLResult {
    return this.adapter.buildTruncateTableQuery(params)
  }

  /**
   * Build an ALTER TABLE RENAME query (returns SQL only, does not execute)
   */
  buildRenameTableQuery(params: RenameTableParams): DDLResult {
    return this.adapter.buildRenameTableQuery(params)
  }

  /**
   * Build an ALTER TABLE ADD COLUMN query (returns SQL only, does not execute)
   */
  buildAddColumnQuery(params: AddColumnParams): DDLResult {
    return this.adapter.buildAddColumnQuery(params)
  }

  /**
   * Build an ALTER TABLE DROP COLUMN query (returns SQL only, does not execute)
   */
  buildDropColumnQuery(params: DropColumnParams): DDLResult {
    return this.adapter.buildDropColumnQuery(params)
  }

  /**
   * Build an ALTER TABLE RENAME COLUMN query (returns SQL only, does not execute)
   */
  buildRenameColumnQuery(params: RenameColumnParams): DDLResult {
    return this.adapter.buildRenameColumnQuery(params)
  }

  /**
   * Build an ALTER TABLE ALTER COLUMN query (returns SQL only, does not execute)
   */
  buildAlterColumnQuery(params: AlterColumnParams): DDLResult {
    return this.adapter.buildAlterColumnQuery(params)
  }

  /**
   * Build a CREATE INDEX query (returns SQL only, does not execute)
   */
  buildCreateIndexQuery(params: CreateIndexParams): DDLResult {
    return this.adapter.buildCreateIndexQuery(params)
  }

  /**
   * Build a DROP INDEX query (returns SQL only, does not execute)
   */
  buildDropIndexQuery(params: DropIndexParams): DDLResult {
    return this.adapter.buildDropIndexQuery(params)
  }

  /**
   * Build an ALTER TABLE ADD CONSTRAINT FOREIGN KEY query (returns SQL only, does not execute)
   */
  buildAddForeignKeyQuery(params: AddForeignKeyParams): DDLResult {
    return this.adapter.buildAddForeignKeyQuery(params)
  }

  /**
   * Build an ALTER TABLE DROP CONSTRAINT query for foreign key (returns SQL only, does not execute)
   */
  buildDropForeignKeyQuery(params: DropForeignKeyParams): DDLResult {
    return this.adapter.buildDropForeignKeyQuery(params)
  }
}
