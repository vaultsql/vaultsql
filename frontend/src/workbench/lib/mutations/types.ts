import type {
  ColumnDefinition,
  MutationColumnValue,
  PrimaryKeyValue,
} from '@/workbench/types/database'

/**
 * Mutation types supported by the queue.
 * Format: "resource.action"
 */
export type MutationType =
  | 'table.insert-row'
  | 'table.update-row'
  | 'table.delete-row'
  | 'table.add-column'
  | 'table.drop-column'

/**
 * Payload types for each mutation type.
 */
export type MutationPayloadMap = {
  'table.insert-row': {
    values: MutationColumnValue[]
  }
  'table.update-row': {
    values: MutationColumnValue[]
    primaryKey: PrimaryKeyValue
  }
  'table.delete-row': {
    primaryKey: PrimaryKeyValue
  }
  'table.add-column': {
    column: ColumnDefinition
  }
  'table.drop-column': {
    column: string
    cascade?: boolean
  }
}

/**
 * A queued mutation entry.
 * Stored in the mutation queue until committed.
 */
export type MutationEntry<T extends MutationType = MutationType> = {
  /** Unique identifier for this entry */
  id: string
  /** Mutation type from the registry */
  type: T
  /** Schema-qualified target (e.g., "public.users") */
  target: string
  /** Type-specific payload data */
  payload: MutationPayloadMap[T]
  /** Timestamp when the mutation was queued */
  createdAt: number
}

/**
 * Result of hydrating a mutation entry into SQL.
 */
export type HydratedMutation = {
  entry: MutationEntry
  sql: string
  operation: string
}

/**
 * Parse a schema-qualified target string into schema and table.
 */
export function parseTarget(target: string): { schema: string; table: string } {
  const parts = target.split('.')
  if (parts.length !== 2) {
    throw new Error(`Invalid target format: ${target}. Expected "schema.table"`)
  }
  return { schema: parts[0], table: parts[1] }
}

/**
 * Create a schema-qualified target string.
 */
export function createTarget(schema: string, table: string): string {
  return `${schema}.${table}`
}

/**
 * Helper to create a typed mutation entry.
 */
export function createMutationEntry<T extends MutationType>(
  type: T,
  target: string,
  payload: MutationPayloadMap[T],
): MutationEntry<T> {
  return {
    id: crypto.randomUUID(),
    type,
    target,
    payload,
    createdAt: Date.now(),
  }
}

/**
 * Type guard to check if an entry is of a specific mutation type.
 */
export function isMutationType<T extends MutationType>(
  entry: MutationEntry,
  type: T,
): entry is MutationEntry<T> {
  return entry.type === type
}
