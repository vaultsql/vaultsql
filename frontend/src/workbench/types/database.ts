import type { components } from '@/lib/openapi'

// Re-export from OpenAPI schema
export type QueryResponse = components['schemas']['QueryResponse']

// Column data types and categories
export type ColumnCategory =
  | 'text'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'timestamp'
  | 'date'
  | 'time'
  | 'uuid'
  | 'json'
  | 'array'
  | 'other'

// Column metadata from database schema
export type ColumnInfo = {
  name: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
  comment: string | null
  category: ColumnCategory
  hasServerDefault: boolean // true if default is a function like NOW(), nextval(), etc.
  isGenerated: boolean // true for GENERATED columns or SERIAL types
  isAutoIncrement: boolean // true for SERIAL/BIGSERIAL
}

// Index metadata
export type IndexInfo = {
  name: string
  columns: string[]
  isUnique: boolean
  isPrimary: boolean
  type: string // btree, hash, gin, gist, etc.
}

// Foreign key metadata
export type ForeignKeyInfo = {
  constraintName: string
  column: string
  refSchema: string
  refTable: string
  refColumn: string
  onUpdate: string
  onDelete: string
}

// Complete table structure (columns + indexes + foreign keys)
export type TableStructure = {
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
}

// Database connection info
export type DatabaseInfo = {
  name: string
  type: 'postgres' | 'mysql'
  schema: string
}

export type QueryActor = 'application' | 'user' | 'custom' | 'table'

export type QueryAudit = {
  actor?: QueryActor
  operation?: string
}

export type ExportFormat = 'csv' | 'json' | 'sql'

export type ExportRunOptions = {
  format: ExportFormat
  columns?: string[]
  csvDelimiter?: string
  sqlTable?: string
}

export type ExportRunResult = {
  blob: Blob
  filename: string
  contentType: string
}

// Query execution function type
export type RunQueryFn = (query: string, audit?: QueryAudit) => Promise<QueryResponse>

export type StreamQueryHandlers = {
  onColumns?: (columns: QueryResponse['columns']) => void
  onRow?: (row: Record<string, unknown>) => void
  onComplete?: (info: { rowCount: number; truncated: boolean }) => void
  onError?: (message: string) => void
}

export type StreamQueryFn = (
  query: string,
  handlers?: StreamQueryHandlers,
  audit?: QueryAudit,
) => Promise<QueryResponse>

// Query history
export type HistoryItem = {
  id: string
  query: string
  timestamp: number
  durationMs: number
  rowCount: number | undefined
  operation?: string
  actor?: QueryActor
  error?: string
}

// Filter operators for table data filtering
export type FilterOperator =
  | 'eq' // equals
  | 'neq' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equal
  | 'lt' // less than
  | 'lte' // less than or equal
  | 'contains' // contains substring (case-sensitive)
  | 'icontains' // contains substring (case-insensitive)
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull'
  | 'in' // in list

// Core filter data - used for serialization, API calls, config storage
export type FilterInput = {
  column: string
  operator: FilterOperator
  value: string
}

// Filter with UI state - used in React components
export type Filter = FilterInput & {
  id: string // For React keys
}

// Helper to hydrate FilterInput -> Filter
export function hydrateFilter(input: FilterInput): Filter {
  return { ...input, id: crypto.randomUUID() }
}

export function hydrateFilters(inputs: FilterInput[]): Filter[] {
  return inputs.map(hydrateFilter)
}

// Helper to convert Filter -> FilterInput (remove IDs)
export function toFilterInputs(filters: Filter[]): FilterInput[] {
  return filters.map(({ column, operator, value }) => ({ column, operator, value }))
}

// Filter operator configuration
export type OperatorConfig = {
  operator: FilterOperator
  label: string
  needsValue: boolean
}

// Operator configuration for SQL filters
export const FILTER_OPERATORS: OperatorConfig[] = [
  { operator: 'eq', label: '=', needsValue: true },
  { operator: 'neq', label: '!=', needsValue: true },
  { operator: 'gt', label: '>', needsValue: true },
  { operator: 'gte', label: '>=', needsValue: true },
  { operator: 'lt', label: '<', needsValue: true },
  { operator: 'lte', label: '<=', needsValue: true },
  { operator: 'contains', label: 'LIKE', needsValue: true },
  { operator: 'icontains', label: 'ILIKE', needsValue: true },
  { operator: 'startsWith', label: 'starts with', needsValue: true },
  { operator: 'endsWith', label: 'ends with', needsValue: true },
  { operator: 'isNull', label: 'IS NULL', needsValue: false },
  { operator: 'isNotNull', label: 'IS NOT NULL', needsValue: false },
  { operator: 'in', label: 'IN', needsValue: true },
]

// Which operators are available for each column category
export const OPERATORS_BY_CATEGORY: Record<ColumnCategory, FilterOperator[]> = {
  text: [
    'eq',
    'neq',
    'contains',
    'icontains',
    'startsWith',
    'endsWith',
    'isNull',
    'isNotNull',
    'in',
  ],
  integer: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull', 'in'],
  float: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  boolean: ['eq', 'neq', 'isNull', 'isNotNull'],
  timestamp: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  time: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull'],
  uuid: ['eq', 'neq', 'isNull', 'isNotNull', 'in'],
  json: ['isNull', 'isNotNull'],
  array: ['isNull', 'isNotNull'],
  other: ['eq', 'neq', 'isNull', 'isNotNull'],
}

// Helper: get available operators for a column category
export function getOperatorsForCategory(category: ColumnCategory): OperatorConfig[] {
  const allowedOperators = OPERATORS_BY_CATEGORY[category] ?? OPERATORS_BY_CATEGORY.other
  return FILTER_OPERATORS.filter((op) => allowedOperators.includes(op.operator))
}

// Helper: get the default operator for a column category
export function getDefaultOperator(category: ColumnCategory): FilterOperator {
  const operators = getOperatorsForCategory(category)
  return operators[0]?.operator ?? 'eq'
}

// Helper: check if an operator requires a value input
export function operatorNeedsValue(operator: FilterOperator): boolean {
  const config = FILTER_OPERATORS.find((op) => op.operator === operator)
  return config?.needsValue ?? true
}

// Helper: get the display label for an operator
export function getOperatorLabel(operator: FilterOperator): string {
  const config = FILTER_OPERATORS.find((op) => op.operator === operator)
  return config?.label ?? operator
}

// Value state for column inputs (used in row editing)
export type ColumnValue = {
  value: string
  isNull: boolean
  useDefault: boolean
}

// Workbench backend services
export interface WorkbenchQueryService {
  run(query: string, audit?: QueryAudit): Promise<QueryResponse>
  streamQuery(
    query: string,
    handlers?: StreamQueryHandlers,
    audit?: QueryAudit,
  ): Promise<QueryResponse>
  exportQuery(
    query: string,
    options: ExportRunOptions,
    audit?: QueryAudit,
  ): Promise<ExportRunResult>
}

export interface WorkbenchHistoryService {
  list(): Promise<HistoryItem[]>
  add(item: HistoryItem): Promise<void>
  clear(): Promise<void>
}

export interface WorkbenchBackend {
  databaseId: string
  database: DatabaseInfo
  query: WorkbenchQueryService
  history: WorkbenchHistoryService
}

// Database adapter interface (for loading schema metadata)
export type WorkbenchAsset = {
  name: string
  type: 'table' | 'view'
  schema: string
}

// Schema objects (programmable database objects)
export type SchemaObjectType = 'materialized_view' | 'function' | 'procedure'

export type SchemaObject = {
  name: string
  type: SchemaObjectType
  schema: string
}

export type FetchRowParams = {
  schema: string
  table: string
  column: string
  value: unknown
}

// Sort direction for table queries
export type SortDirection = 'asc' | 'desc'

// Sort specification
export type SortColumn = {
  column: string
  direction: SortDirection
}

// Parameters for building a table query
export type TableQueryParams = {
  schema: string
  table: string
  columns?: string[] // Columns to select (default: all)
  filters?: FilterInput[] // WHERE conditions
  rawWhere?: string // Raw SQL WHERE clause (used instead of filters if provided)
  filterMode?: 'all' | 'any' // How to combine filters: 'all' = AND, 'any' = OR (default: 'all')
  sort?: SortColumn[] // ORDER BY columns
  limit?: number // LIMIT
  offset?: number // OFFSET for pagination
}

// Result of building a table query
export type TableQueryResult = {
  sql: string // The generated SQL
  countSql: string // SQL to get total count (for pagination)
}

// Parameters for building an export query
export type ExportQueryParams = {
  schema: string
  table: string
  columns?: string[] // Columns to export (default: all)
  filters?: FilterInput[] // WHERE conditions
  sort?: SortColumn[] // ORDER BY columns
  limit?: number // LIMIT
  offset?: number // OFFSET for pagination
}

// Result of building an export query
export type ExportQueryResult = {
  sql: string // The generated SQL
}

// Parameters for building an estimated count query
export type EstimatedCountParams = {
  schema: string
  table: string
  filters?: FilterInput[] // WHERE conditions (for filtered counts)
}

// Result of building an estimated count query
export type EstimatedCountResult = {
  sql: string // The generated SQL for estimated count
  fallbackSql: string // Fallback SQL using COUNT(*) if estimate fails
}

// ============ Mutation Types ============

// Result of building a mutation query (SQL only, not executed)
export type MutationResult = {
  sql: string
  operation: 'insert' | 'update' | 'delete'
  table: string
  schema: string
}

// Primary key value for identifying rows
export type PrimaryKeyValue = {
  column: string
  value: unknown
}

// Column value for mutations (supports null and default)
export type MutationColumnValue = {
  column: string
  value: unknown
  isNull?: boolean
  useDefault?: boolean
}

// Parameters for INSERT
export type InsertParams = {
  schema: string
  table: string
  values: MutationColumnValue[]
}

// Parameters for UPDATE
export type UpdateParams = {
  schema: string
  table: string
  values: MutationColumnValue[]
  primaryKey: PrimaryKeyValue
}

// Parameters for DELETE
export type DeleteParams = {
  schema: string
  table: string
  primaryKey: PrimaryKeyValue
}

// ============ DDL Types ============

// Foreign key reference action
export type ForeignKeyAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT'

// Column definition for CREATE TABLE and ADD COLUMN
export type ColumnDefinition = {
  name: string
  dataType: string // e.g., 'VARCHAR(255)', 'INTEGER', 'SERIAL'
  nullable?: boolean // DEFAULT true
  defaultValue?: string | null // Raw SQL default expression
  primaryKey?: boolean
  unique?: boolean
  references?: {
    // Foreign key reference
    schema: string
    table: string
    column: string
    onDelete?: ForeignKeyAction
    onUpdate?: ForeignKeyAction
  }
  check?: string // CHECK constraint expression
}

// Index type for PostgreSQL
export type IndexType = 'btree' | 'hash' | 'gin' | 'gist' | 'brin'

// Index definition for CREATE TABLE and CREATE INDEX
export type IndexDefinition = {
  name?: string // Optional - will be auto-generated if not provided
  columns: string[]
  unique?: boolean
  type?: IndexType
}

// DDL operation type
export type DDLOperation =
  | 'create_table'
  | 'alter_table'
  | 'drop_table'
  | 'truncate_table'
  | 'create_index'
  | 'drop_index'

// Result type for DDL operations (consistent with MutationResult)
export type DDLResult = {
  sql: string
  operation: DDLOperation
  schema: string
  table: string
}

// CREATE TABLE
export type CreateTableParams = {
  schema: string
  table: string
  columns: ColumnDefinition[]
  indexes?: IndexDefinition[]
  ifNotExists?: boolean
}

// DROP TABLE
export type DropTableParams = {
  schema: string
  table: string
  ifExists?: boolean
  cascade?: boolean
}

// TRUNCATE TABLE
export type TruncateTableParams = {
  schema: string
  table: string
  cascade?: boolean
  restartIdentity?: boolean
}

// ALTER TABLE - Rename
export type RenameTableParams = {
  schema: string
  table: string
  newName: string
}

// ALTER TABLE - Add Column
export type AddColumnParams = {
  schema: string
  table: string
  column: ColumnDefinition
}

// ALTER TABLE - Drop Column
export type DropColumnParams = {
  schema: string
  table: string
  column: string
  cascade?: boolean
}

// ALTER TABLE - Rename Column
export type RenameColumnParams = {
  schema: string
  table: string
  column: string
  newName: string
}

// ALTER TABLE - Modify Column (change type, nullable, default)
export type AlterColumnParams = {
  schema: string
  table: string
  column: string
  dataType?: string // SET DATA TYPE
  nullable?: boolean // SET NOT NULL / DROP NOT NULL
  defaultValue?: string | null // SET DEFAULT / DROP DEFAULT
}

// CREATE INDEX
export type CreateIndexParams = {
  schema: string
  table: string
  index: IndexDefinition
  ifNotExists?: boolean
}

// DROP INDEX
export type DropIndexParams = {
  schema: string
  indexName: string
  table?: string // Required for MySQL, optional for PostgreSQL
  ifExists?: boolean
  cascade?: boolean
}

// ALTER TABLE - Add Foreign Key
export type AddForeignKeyParams = {
  schema: string
  table: string
  column: string
  constraintName?: string // Optional - will be auto-generated if not provided
  refSchema: string
  refTable: string
  refColumn: string
  onDelete?: ForeignKeyAction
  onUpdate?: ForeignKeyAction
}

// ALTER TABLE - Drop Foreign Key
export type DropForeignKeyParams = {
  schema: string
  table: string
  constraintName: string
  cascade?: boolean
}

export type DatabaseAdapter = {
  loadSchemaNames: () => Promise<string[]>
  loadSchemaAssets: (schemaName: string) => Promise<WorkbenchAsset[]>
  loadSchemaObjects?: (schemaName: string) => Promise<SchemaObject[]>
  getObjectDefinition?: (
    schema: string,
    objectName: string,
    objectType: SchemaObjectType,
  ) => Promise<string>
  getViewDefinition?: (schema: string, viewName: string) => Promise<string>
  describeTable: (schema: string, table: string) => Promise<TableStructure>
  loadAllColumns?: (schemaName: string) => Promise<Map<string, ColumnInfo[]>>
  fetchRow: (params: FetchRowParams) => Promise<Record<string, unknown> | null>
  buildTableQuery: (params: TableQueryParams) => TableQueryResult
  buildExportQuery: (params: ExportQueryParams) => ExportQueryResult
  buildEstimatedCountQuery: (params: EstimatedCountParams) => EstimatedCountResult
  // Mutation query builders (return SQL only, not executed)
  buildInsertQuery: (params: InsertParams) => MutationResult
  buildUpdateQuery: (params: UpdateParams) => MutationResult
  buildDeleteQuery: (params: DeleteParams) => MutationResult
  // DDL query builders (return SQL only, not executed)
  buildCreateTableQuery: (params: CreateTableParams) => DDLResult
  buildDropTableQuery: (params: DropTableParams) => DDLResult
  buildTruncateTableQuery: (params: TruncateTableParams) => DDLResult
  buildRenameTableQuery: (params: RenameTableParams) => DDLResult
  buildAddColumnQuery: (params: AddColumnParams) => DDLResult
  buildDropColumnQuery: (params: DropColumnParams) => DDLResult
  buildRenameColumnQuery: (params: RenameColumnParams) => DDLResult
  buildAlterColumnQuery: (params: AlterColumnParams) => DDLResult
  buildCreateIndexQuery: (params: CreateIndexParams) => DDLResult
  buildDropIndexQuery: (params: DropIndexParams) => DDLResult
  buildAddForeignKeyQuery: (params: AddForeignKeyParams) => DDLResult
  buildDropForeignKeyQuery: (params: DropForeignKeyParams) => DDLResult
}

export type DatabaseAdapterFactory = (
  runQuery: RunQueryFn,
  database: DatabaseInfo,
) => DatabaseAdapter
