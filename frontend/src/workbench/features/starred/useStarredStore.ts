import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type StarredItem = {
  id: string
  type: 'table' | 'row'
  schema: string
  table: string
  // For row stars only:
  primaryKeyColumn?: string
  primaryKeyValue?: string
  displayLabel?: string
  createdAt: number
}

type StarredStoreState = {
  stars: StarredItem[]
}

type StarredStoreActions = {
  addTableStar: (schema: string, table: string) => void
  addRowStar: (
    schema: string,
    table: string,
    pkColumn: string,
    pkValue: string,
    displayLabel?: string,
  ) => void
  removeStar: (id: string) => void
  clearStars: () => void
  hasTableStar: (schema: string, table: string) => boolean
  hasRowStar: (schema: string, table: string, pkColumn: string, pkValue: string) => boolean
  getTableStarId: (schema: string, table: string) => string | null
  getRowStarId: (schema: string, table: string, pkColumn: string, pkValue: string) => string | null
}

type StarredStore = StarredStoreState & StarredStoreActions

const STORAGE_PREFIX = 'workbench:starred-rows:'

/**
 * Create a starred rows store scoped to a specific accountId.
 * This allows each database account to have its own set of starred rows.
 */
export function createStarredStore(accountId: string) {
  return create<StarredStore>()(
    persist(
      (set, get) => ({
        stars: [],

        addTableStar: (schema, table) => {
          const id = crypto.randomUUID()
          const newStar: StarredItem = {
            id,
            type: 'table',
            schema,
            table,
            createdAt: Date.now(),
          }

          set((state) => ({
            stars: [newStar, ...state.stars],
          }))
        },

        addRowStar: (schema, table, pkColumn, pkValue, displayLabel) => {
          const id = crypto.randomUUID()
          const newStar: StarredItem = {
            id,
            type: 'row',
            schema,
            table,
            primaryKeyColumn: pkColumn,
            primaryKeyValue: pkValue,
            displayLabel,
            createdAt: Date.now(),
          }

          set((state) => ({
            stars: [newStar, ...state.stars],
          }))
        },

        removeStar: (id) => {
          set((state) => ({
            stars: state.stars.filter((s) => s.id !== id),
          }))
        },

        clearStars: () => {
          set({ stars: [] })
        },

        hasTableStar: (schema, table) => {
          const stars = get().stars
          return stars.some((s) => s.type === 'table' && s.schema === schema && s.table === table)
        },

        hasRowStar: (schema, table, pkColumn, pkValue) => {
          const stars = get().stars
          return stars.some(
            (s) =>
              s.type === 'row' &&
              s.schema === schema &&
              s.table === table &&
              s.primaryKeyColumn === pkColumn &&
              s.primaryKeyValue === pkValue,
          )
        },

        getTableStarId: (schema, table) => {
          const stars = get().stars
          const star = stars.find(
            (s) => s.type === 'table' && s.schema === schema && s.table === table,
          )
          return star?.id ?? null
        },

        getRowStarId: (schema, table, pkColumn, pkValue) => {
          const stars = get().stars
          const star = stars.find(
            (s) =>
              s.type === 'row' &&
              s.schema === schema &&
              s.table === table &&
              s.primaryKeyColumn === pkColumn &&
              s.primaryKeyValue === pkValue,
          )
          return star?.id ?? null
        },
      }),
      {
        name: `${STORAGE_PREFIX}${accountId}`,
      },
    ),
  )
}

export type StarredStoreApi = ReturnType<typeof createStarredStore>
