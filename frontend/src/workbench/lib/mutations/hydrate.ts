import type { DatabaseService } from '../DatabaseService'
import type { HydratedMutation, MutationEntry } from './types'
import { parseTarget } from './types'

/**
 * Hydrate a mutation entry into SQL using the DatabaseService.
 * Returns the generated SQL and operation metadata.
 */
export function hydrateMutation(entry: MutationEntry, db: DatabaseService): HydratedMutation {
  const { schema, table } = parseTarget(entry.target)

  switch (entry.type) {
    case 'table.insert-row': {
      const payload = entry.payload as MutationEntry<'table.insert-row'>['payload']
      const result = db.buildInsertQuery({
        schema,
        table,
        values: payload.values,
      })
      return {
        entry,
        sql: result.sql,
        operation: result.operation,
      }
    }

    case 'table.update-row': {
      const payload = entry.payload as MutationEntry<'table.update-row'>['payload']
      const result = db.buildUpdateQuery({
        schema,
        table,
        values: payload.values,
        primaryKey: payload.primaryKey,
      })
      return {
        entry,
        sql: result.sql,
        operation: result.operation,
      }
    }

    case 'table.delete-row': {
      const payload = entry.payload as MutationEntry<'table.delete-row'>['payload']
      const result = db.buildDeleteQuery({
        schema,
        table,
        primaryKey: payload.primaryKey,
      })
      return {
        entry,
        sql: result.sql,
        operation: result.operation,
      }
    }

    case 'table.add-column': {
      const payload = entry.payload as MutationEntry<'table.add-column'>['payload']
      const result = db.buildAddColumnQuery({
        schema,
        table,
        column: payload.column,
      })
      return {
        entry,
        sql: result.sql,
        operation: result.operation,
      }
    }

    case 'table.drop-column': {
      const payload = entry.payload as MutationEntry<'table.drop-column'>['payload']
      const result = db.buildDropColumnQuery({
        schema,
        table,
        column: payload.column,
        cascade: payload.cascade,
      })
      return {
        entry,
        sql: result.sql,
        operation: result.operation,
      }
    }

    default: {
      const _exhaustive: never = entry.type
      throw new Error(`Unknown mutation type: ${_exhaustive}`)
    }
  }
}

/**
 * Hydrate all mutation entries in a queue.
 */
export function hydrateAllMutations(
  entries: MutationEntry[],
  db: DatabaseService,
): HydratedMutation[] {
  return entries.map((entry) => hydrateMutation(entry, db))
}
