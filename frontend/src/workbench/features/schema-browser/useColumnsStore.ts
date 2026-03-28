import { create } from 'zustand'
import type { ColumnInfo } from '@/workbench/types/database'

type ColumnsStatus = 'idle' | 'loading' | 'success' | 'error'

type ColumnsStoreState = {
  // Map of "schema.table" -> ColumnInfo[]
  columns: Map<string, ColumnInfo[]>
  status: ColumnsStatus
  error: string | null
}

type ColumnsStoreActions = {
  beginLoad: () => void
  mergeColumns: (columns: Map<string, ColumnInfo[]>) => void
  failLoad: (error: string) => void
  invalidateTable: (schema: string, table: string) => void
  invalidateSchema: (schema: string) => void
  invalidateAll: () => void
  getTableColumns: (schema: string, table: string) => ColumnInfo[] | undefined
}

export type ColumnsStore = ColumnsStoreState & ColumnsStoreActions

function makeTableKey(schema: string, table: string): string {
  return `${schema}.${table}`
}

export const useColumnsStore = create<ColumnsStore>((set, get) => ({
  columns: new Map(),
  status: 'idle',
  error: null,

  beginLoad: () =>
    set({
      status: 'loading',
      error: null,
    }),

  mergeColumns: (newColumns) => {
    const existing = get().columns
    const merged = new Map(existing)
    for (const [key, value] of newColumns) {
      merged.set(key, value)
    }
    set({
      columns: merged,
      status: 'success',
      error: null,
    })
  },

  failLoad: (error) =>
    set({
      status: 'error',
      error,
    }),

  invalidateTable: (schema, table) => {
    const key = makeTableKey(schema, table)
    const columns = new Map(get().columns)
    columns.delete(key)
    set({ columns })
  },

  invalidateSchema: (schema) => {
    const columns = new Map(get().columns)
    const prefix = `${schema}.`
    for (const key of columns.keys()) {
      if (key.startsWith(prefix)) {
        columns.delete(key)
      }
    }
    set({ columns })
  },

  invalidateAll: () =>
    set({
      columns: new Map(),
      status: 'idle',
      error: null,
    }),

  getTableColumns: (schema, table) => {
    const key = makeTableKey(schema, table)
    return get().columns.get(key)
  },
}))
