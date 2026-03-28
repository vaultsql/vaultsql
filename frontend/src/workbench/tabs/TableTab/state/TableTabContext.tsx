import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { components } from '@/lib/openapi'
import {
  createMutationQueueStore,
  type MutationQueueStoreApi,
  useMutationQueue,
} from '@/workbench/lib/mutations'
import type { ColumnInfo, Filter, FilterInput, ForeignKeyInfo } from '@/workbench/types/database'
import { hydrateFilters, toFilterInputs } from '@/workbench/types/database'
import { useWorkbench } from '../../../context/useWorkbench'
import { useWorkbenchSettingsStore } from '../../../context/useWorkbenchSettingsStore'
import type { TabDescriptor, TableTabConfig } from '../../useTabsStore'
import { useTabsStore } from '../../useTabsStore'
import { useTableColumns } from '../hooks/useTableColumns'
import { useTableForeignKeys } from '../hooks/useTableForeignKeys'
import { createTableTabStore, type TableTabStoreApi } from './useTableTabStore'

type QueryResponse = components['schemas']['QueryResponse']

interface TableTabContextValue {
  tab: TabDescriptor
  schema: string
  table: string
  dbType: string
  columns: ColumnInfo[]
  foreignKeys: ForeignKeyInfo[]
  store: TableTabStoreApi
  mutationStore: MutationQueueStoreApi
  isView: boolean
  canUpdateData: boolean
  canUpdateStructure: boolean
  canSeeIndexes: boolean
  canSeeForeignKeys: boolean
  fetchData: (filters?: FilterInput[], rawWhere?: string) => Promise<void>
}

const TableTabContext = createContext<TableTabContextValue | null>(null)
const STREAM_FLUSH_INTERVAL_MS = 50

function getTableTabConfig(tab: TabDescriptor): TableTabConfig {
  const config = tab.config as TableTabConfig
  return {
    schema: config.schema ?? '',
    table: config.table ?? '',
    isView: config.isView,
    filters: config.filters,
    filterMode: config.filterMode,
  }
}

export function TableTabProvider({
  tab,
  children,
}: {
  tab: TabDescriptor
  children: React.ReactNode
}) {
  const { db, permissions } = useWorkbench()
  const allowEditOperations = useWorkbenchSettingsStore((s) => s.allowEditOperations)
  const allowTableModify = useWorkbenchSettingsStore((s) => s.allowTableModify)
  const config = getTableTabConfig(tab)
  const { schema, table } = config

  // Hydrate filters from config (add ids for React keys)
  // Using JSON.stringify for stable dependency comparison
  const initialFilters: Filter[] = useMemo(
    () => hydrateFilters(config.filters ?? []),
    [JSON.stringify(config.filters ?? [])],
  )

  // Create Zustand store instance for this tab
  const storeRef = useRef<TableTabStoreApi | null>(null)
  if (!storeRef.current) {
    storeRef.current = createTableTabStore(initialFilters, config.filterMode ?? 'all')
  }
  const store = storeRef.current

  // Create mutation queue store for this tab
  const mutationStoreRef = useRef<MutationQueueStoreApi | null>(null)
  if (!mutationStoreRef.current) {
    mutationStoreRef.current = createMutationQueueStore()
  }
  const mutationStore = mutationStoreRef.current

  const columns = useTableColumns({ schema, table })
  const foreignKeys = useTableForeignKeys({ schema, table })

  // Data fetching logic
  const hasFetchedRef = useRef(false)
  const requestIdRef = useRef(0)
  const rowsRef = useRef<Record<string, unknown>[]>([])
  const rowsBufferRef = useRef<Record<string, unknown>[]>([])
  const columnsRef = useRef<QueryResponse['columns']>([])
  const flushTimeoutRef = useRef<number | null>(null)

  const fetchData = React.useCallback(
    async (filters: FilterInput[] = [], rawWhere?: string) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      store.getState().setDataLoading()

      rowsRef.current = []
      rowsBufferRef.current = []
      columnsRef.current = []
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current)
        flushTimeoutRef.current = null
      }

      try {
        // Fetch estimated row count for pagination (only if not in limit/offset mode and no filters/raw SQL)
        const state = store.getState()
        const shouldFetchCount = !state.limitOffset && filters.length === 0 && !rawWhere

        if (shouldFetchCount) {
          try {
            const { sql: countSql, fallbackSql } = db.buildEstimatedCountQuery({
              schema,
              table,
              filters,
            })

            // Try estimated count first
            let countResponse = await db.query(countSql, {
              actor: 'application',
              operation: 'estimated_count',
            })

            // Helper to extract count from result (handles different field names and types)
            const extractCount = (result: Record<string, unknown> | undefined): number | null => {
              if (!result) return null

              // Try different possible field names
              const value =
                result.count ?? result.Count ?? result.COUNT ?? result.total ?? result.Total

              if (value === null || value === undefined) return null

              // Handle bigint, string, or number
              if (typeof value === 'bigint') return Number(value)
              if (typeof value === 'string') {
                const parsed = Number.parseInt(value, 10)
                return Number.isNaN(parsed) ? null : parsed
              }
              if (typeof value === 'number') return value

              return null
            }

            // If estimate returns null/0 or fails, try fallback
            const countResult = countResponse.result?.[0] as Record<string, unknown> | undefined
            const estimatedCount = extractCount(countResult)

            if (!estimatedCount || estimatedCount === 0 || estimatedCount < 0) {
              countResponse = await db.query(fallbackSql, {
                actor: 'application',
                operation: 'count',
              })
              const fallbackResult = countResponse.result?.[0] as
                | Record<string, unknown>
                | undefined
              const fallbackCount = extractCount(fallbackResult)
              store.getState().setTotalRowCount(fallbackCount)
            } else {
              store.getState().setTotalRowCount(estimatedCount)
            }
          } catch (err) {
            // Count failed, continue without it
            store.getState().setTotalRowCount(null)
          }
        } else if (filters.length > 0 || rawWhere) {
          // With filters or raw SQL, we don't have a good count - set to null
          store.getState().setTotalRowCount(null)
        }

        // Build data query with pagination
        const paginationState = store.getState()
        const filterMode = paginationState.filterMode
        const limit = paginationState.limitOffset?.limit ?? paginationState.pageSize
        const offset =
          paginationState.limitOffset?.offset ??
          paginationState.currentPage * paginationState.pageSize

        const { sql } = db.buildTableQuery({
          schema,
          table,
          filters,
          rawWhere,
          filterMode,
          limit,
          offset,
        })

        const flushRows = () => {
          if (requestId !== requestIdRef.current) return
          if (rowsBufferRef.current.length === 0) return

          rowsRef.current = rowsRef.current.concat(rowsBufferRef.current)
          rowsBufferRef.current = []

          store.getState().updateStreamingData({
            success: true,
            columns: columnsRef.current ?? [],
            result: rowsRef.current,
          })
        }

        const scheduleFlush = () => {
          if (flushTimeoutRef.current !== null) return
          flushTimeoutRef.current = window.setTimeout(() => {
            flushTimeoutRef.current = null
            flushRows()
          }, STREAM_FLUSH_INTERVAL_MS)
        }

        const response = await db.streamQuery(
          sql,
          {
            onColumns: (columns) => {
              if (requestId !== requestIdRef.current) return
              columnsRef.current = columns ?? []
              store.getState().updateStreamingData({
                success: true,
                columns: columnsRef.current,
                result: rowsRef.current,
              })
            },
            onRow: (row) => {
              if (requestId !== requestIdRef.current) return
              rowsBufferRef.current.push(row)
              scheduleFlush()
            },
            onError: (message) => {
              if (requestId !== requestIdRef.current) return
              store.getState().setDataError(message)
            },
            onComplete: () => {
              if (requestId !== requestIdRef.current) return
              flushRows()
            },
          },
          {
            actor: 'application',
            operation: 'table_query',
          },
        )

        if (requestId !== requestIdRef.current) return

        if (response.success) {
          flushRows()
          store.getState().setDataSuccess(response)
        } else {
          store.getState().setDataError(response.error ?? 'Failed to load table data')
        }
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        store.getState().setDataError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    [schema, table, db, store],
  )

  // Load data on mount with initial filters
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      void fetchData(
        initialFilters.map((f) => ({ column: f.column, operator: f.operator, value: f.value })),
      )
    }
  }, [fetchData, initialFilters])

  // React to filter changes from config (e.g., when resetTabFilters is called)
  useEffect(() => {
    if (hasFetchedRef.current && initialFilters.length > 0) {
      store.getState().setFilters(initialFilters)
      void fetchData(
        initialFilters.map((f) => ({ column: f.column, operator: f.operator, value: f.value })),
      )
    }
  }, [initialFilters, fetchData, store])

  // Cleanup
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current)
      }
    }
  }, [])

  // Re-fetch data when pagination changes
  useEffect(() => {
    const unsubscribe = store.subscribe(
      (state) => ({
        currentPage: state.currentPage,
        pageSize: state.pageSize,
        limitOffset: state.limitOffset,
      }),
      (pagination, prevPagination) => {
        // Only re-fetch if pagination actually changed and we've already done initial fetch
        if (
          hasFetchedRef.current &&
          (pagination.currentPage !== prevPagination.currentPage ||
            pagination.pageSize !== prevPagination.pageSize ||
            JSON.stringify(pagination.limitOffset) !== JSON.stringify(prevPagination.limitOffset))
        ) {
          const filters = store.getState().filters
          void fetchData(toFilterInputs(filters))
        }
      },
    )

    return () => unsubscribe()
  }, [store, fetchData])

  const isView = config.isView ?? false
  // Combine all permission sources:
  // 1. Asset type (views are not editable)
  // 2. Workbench permissions (access level)
  // 3. Session settings (user toggles)
  const canUpdateData = !isView && permissions.canWrite && allowEditOperations
  const canUpdateStructure = !isView && permissions.canAlterTables && allowTableModify
  const canSeeIndexes = !isView
  const canSeeForeignKeys = !isView

  const value = useMemo(
    () => ({
      tab,
      schema,
      table,
      dbType: db.type,
      columns,
      foreignKeys,
      store,
      mutationStore,
      isView,
      canUpdateData,
      canUpdateStructure,
      canSeeIndexes,
      canSeeForeignKeys,
      fetchData,
    }),
    [
      tab,
      schema,
      table,
      db.type,
      columns,
      foreignKeys,
      store,
      mutationStore,
      isView,
      canUpdateData,
      canUpdateStructure,
      canSeeIndexes,
      canSeeForeignKeys,
      fetchData,
    ],
  )

  return <TableTabContext.Provider value={value}>{children}</TableTabContext.Provider>
}

export function useTableTabContext() {
  const context = useContext(TableTabContext)
  if (!context) {
    throw new Error('useTableTabContext must be used within a TableTabProvider')
  }
  return context
}

// Helper hook for accessing filter actions with data fetching
export function useTableTabActions() {
  const { store, tab, fetchData } = useTableTabContext()
  const pinTab = useTabsStore((state) => state.pinTab)

  return React.useMemo(
    () => ({
      applyFilters: (filters: FilterInput[]) => {
        // Pin the tab when filters are applied (user interaction)
        if (tab.isPreview) {
          pinTab(tab.id)
        }
        // Keep raw SQL when applying structured filters
        const rawSqlWhere = store.getState().rawSqlWhere
        void fetchData(filters, rawSqlWhere ?? undefined)
      },
      applyRawSql: (sql: string) => {
        // Pin the tab when raw SQL is applied (user interaction)
        if (tab.isPreview) {
          pinTab(tab.id)
        }
        store.getState().setRawSqlWhere(sql)
        // Keep structured filters when applying raw SQL
        const filters = store.getState().filters
        void fetchData(toFilterInputs(filters), sql)
      },
      clearFilters: () => {
        // Pin the tab when filters are cleared (user interaction)
        if (tab.isPreview) {
          pinTab(tab.id)
        }
        store.getState().clearFilters()
        void fetchData([])
      },
      refresh: () => {
        const state = store.getState()
        const rawSqlWhere = state.rawSqlWhere
        const filters = state.filters
        void fetchData(toFilterInputs(filters), rawSqlWhere ?? undefined)
      },
    }),
    [store, tab, fetchData, pinTab],
  )
}

// Helper hook for accessing the mutation queue with hydration
export function useTableTabMutations() {
  const { mutationStore, tab } = useTableTabContext()
  const { db } = useWorkbench()
  const pinTab = useTabsStore((state) => state.pinTab)
  const mutations = useMutationQueue(mutationStore, db)

  // Wrap the queue function to pin the tab on any mutation
  const queueWithPin = React.useCallback(
    <T extends import('@/workbench/lib/mutations/types').MutationType>(
      type: T,
      target: string,
      payload: import('@/workbench/lib/mutations/types').MutationPayloadMap[T],
    ) => {
      // Pin the tab when user makes an edit (queues a mutation)
      if (tab.isPreview) {
        pinTab(tab.id)
      }
      mutations.queue(type, target, payload)
    },
    [mutations, tab, pinTab],
  )

  return {
    ...mutations,
    queue: queueWithPin,
  }
}
