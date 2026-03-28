import { create } from 'zustand'
import type { TableStructure } from '@/workbench/types/database'

type StructureStatus = 'idle' | 'loading' | 'success' | 'error'

type TableStructureEntry = {
  structure: TableStructure
  status: StructureStatus
  error: string | null
}

type TableStructureStoreState = {
  // Map of "schema.table" -> TableStructureEntry
  tables: Map<string, TableStructureEntry>
}

type TableStructureStoreActions = {
  getEntry: (schema: string, table: string) => TableStructureEntry | undefined
  beginLoad: (schema: string, table: string) => void
  setStructure: (schema: string, table: string, structure: TableStructure) => void
  setError: (schema: string, table: string, error: string) => void
  invalidate: (schema: string, table: string) => void
}

export type TableStructureStore = TableStructureStoreState & TableStructureStoreActions

function makeTableKey(schema: string, table: string): string {
  return `${schema}.${table}`
}

const EMPTY_ENTRY: TableStructureEntry = {
  structure: { columns: [], indexes: [], foreignKeys: [] },
  status: 'idle',
  error: null,
}

export const useTableStructureStore = create<TableStructureStore>((set, get) => ({
  tables: new Map(),

  getEntry: (schema, table) => {
    const key = makeTableKey(schema, table)
    return get().tables.get(key)
  },

  beginLoad: (schema, table) => {
    const key = makeTableKey(schema, table)
    const existing = get().tables.get(key)

    // Don't restart if already loading or loaded
    if (existing?.status === 'loading' || existing?.status === 'success') {
      return
    }

    const tables = new Map(get().tables)
    tables.set(key, {
      structure: existing?.structure ?? EMPTY_ENTRY.structure,
      status: 'loading',
      error: null,
    })
    set({ tables })
  },

  setStructure: (schema, table, structure) => {
    const key = makeTableKey(schema, table)
    const tables = new Map(get().tables)
    tables.set(key, {
      structure,
      status: 'success',
      error: null,
    })
    set({ tables })
  },

  setError: (schema, table, error) => {
    const key = makeTableKey(schema, table)
    const tables = new Map(get().tables)
    const existing = tables.get(key)
    tables.set(key, {
      structure: existing?.structure ?? EMPTY_ENTRY.structure,
      status: 'error',
      error,
    })
    set({ tables })
  },

  invalidate: (schema, table) => {
    const key = makeTableKey(schema, table)
    const tables = new Map(get().tables)
    tables.delete(key)
    set({ tables })
  },
}))
