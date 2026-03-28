import { useCallback } from 'react'
import type { DatabaseService } from '../DatabaseService'
import { hydrateAllMutations } from './hydrate'
import type { MutationPayloadMap, MutationType } from './types'
import type { MutationQueueStoreApi } from './useMutationQueueStore'

export type CommitResult = {
  success: boolean
  /** Number of mutations successfully committed */
  committed: number
  /** Error message if any mutation failed */
  error?: string
  /** Index of the failed mutation (if any) */
  failedIndex?: number
}

/**
 * Convenience hook that combines the mutation queue store with commit logic.
 *
 * @param store - The mutation queue store instance
 * @param db - The DatabaseService for hydration and execution
 */
export function useMutationQueue(store: MutationQueueStoreApi, db: DatabaseService) {
  // Subscribe to store state
  const entries = store((s) => s.entries)

  // Actions
  const queue = useCallback(
    <T extends MutationType>(type: T, target: string, payload: MutationPayloadMap[T]) => {
      store.getState().queue(type, target, payload)
    },
    [store],
  )

  const remove = useCallback(
    (id: string) => {
      store.getState().remove(id)
    },
    [store],
  )

  const clear = useCallback(() => {
    store.getState().clear()
  }, [store])

  // Commit all mutations
  const commit = useCallback(async (): Promise<CommitResult> => {
    const currentEntries = store.getState().entries
    if (currentEntries.length === 0) {
      return { success: true, committed: 0 }
    }

    const hydrated = hydrateAllMutations(currentEntries, db)
    let committed = 0

    for (let i = 0; i < hydrated.length; i++) {
      const mutation = hydrated[i]
      try {
        const result = await db.query(mutation.sql, {
          actor: 'user',
          operation: mutation.operation,
        })

        if (!result.success) {
          return {
            success: false,
            committed,
            error: result.error ?? 'Query failed',
            failedIndex: i,
          }
        }

        committed++
      } catch (err) {
        return {
          success: false,
          committed,
          error: err instanceof Error ? err.message : 'Unknown error',
          failedIndex: i,
        }
      }
    }

    // All successful - clear the queue
    store.getState().clear()

    return { success: true, committed }
  }, [store, db])

  return {
    entries,
    count: entries.length,
    isEmpty: entries.length === 0,
    queue,
    remove,
    clear,
    commit,
  }
}
