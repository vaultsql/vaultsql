import { create } from 'zustand'
import type { MutationEntry, MutationPayloadMap, MutationType } from './types'
import { createMutationEntry } from './types'

/**
 * State for the mutation queue store.
 */
type MutationQueueState = {
  /** Ordered list of queued mutations */
  entries: MutationEntry[]
}

/**
 * Actions for the mutation queue store.
 */
type MutationQueueActions = {
  /** Queue a new mutation */
  queue: <T extends MutationType>(type: T, target: string, payload: MutationPayloadMap[T]) => void
  /** Remove a mutation by id */
  remove: (id: string) => void
  /** Clear all mutations */
  clear: () => void
}

/**
 * Combined store type.
 */
export type MutationQueueStore = MutationQueueState & MutationQueueActions

/**
 * Create a new mutation queue store instance.
 * Each tab should have its own store instance.
 */
export function createMutationQueueStore() {
  return create<MutationQueueStore>((set) => ({
    entries: [],

    queue: (type, target, payload) => {
      const entry = createMutationEntry(type, target, payload)
      set((state) => ({
        entries: [...state.entries, entry],
      }))
    },

    remove: (id) => {
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      }))
    },

    clear: () => {
      set({ entries: [] })
    },
  }))
}

/**
 * Type for the store API returned by createMutationQueueStore.
 */
export type MutationQueueStoreApi = ReturnType<typeof createMutationQueueStore>
