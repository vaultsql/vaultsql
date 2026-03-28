import { create } from 'zustand'
import type { components } from '@/lib/openapi'
import type { ColumnInfo, Filter, FilterInput } from '@/workbench/types/database'
import { getDefaultOperator } from '@/workbench/types/database'

type QueryResponse = components['schemas']['QueryResponse']

export type TabStatus = 'idle' | 'loading' | 'success' | 'error'

export type FkReference = {
  schema: string
  table: string
  column: string
  value: unknown
}

export type PrimaryKeyInfo = {
  column: string
}

export type TableInfo = {
  schema: string
  table: string
}

type DetailsMode = 'row' | 'fk-reference'

// Data state
type DataState = {
  status: TabStatus
  result: QueryResponse | null
  error: string | null
  rows: Record<string, unknown>[]
  columnNames: string[]
}

// Pagination state
type PaginationState = {
  totalRowCount: number | null // null = unknown, number = estimated/exact count
  pageSize: number // rows per page
  currentPage: number // 0-indexed
  limitOffset: { limit: number; offset: number } | null // manual LIMIT/OFFSET override
}

// Filter state
type FilterState = {
  filters: Filter[]
  rawSqlWhere: string | null // Raw SQL WHERE clause (used instead of structured filters)
}

// Details state
type DetailsState = {
  detailsRow: Record<string, unknown> | null
  detailsMode: DetailsMode
  fkReference: FkReference | null
  detailsLoading: boolean
  detailsError: string | null
  primaryKey: PrimaryKeyInfo | null
  tableInfo: TableInfo | null
  isDetailsPaneOpen: boolean
}

// Selection state
type SelectionState = {
  selectedRowIndices: Set<number>
}

type TableTabState = DataState & FilterState & DetailsState & SelectionState & PaginationState

type TableTabActions = {
  // Data actions
  setDataLoading: () => void
  setDataSuccess: (result: QueryResponse) => void
  setDataError: (error: string) => void
  updateStreamingData: (result: QueryResponse) => void

  // Filter actions
  setFilters: (filters: Filter[]) => void
  addFilter: (columns: ColumnInfo[]) => void
  clearFilters: () => void
  setRawSqlWhere: (sql: string | null) => void
  setFilterMode: (mode: 'all' | 'any') => void

  // Details actions
  setDetailsRow: (
    row: Record<string, unknown> | null,
    meta?: { primaryKey?: PrimaryKeyInfo; tableInfo?: TableInfo },
  ) => void
  clearDetailsRow: () => void
  setFkReference: (ref: FkReference, row: Record<string, unknown> | null) => void
  setFkLoading: (ref: FkReference) => void
  setFkError: (error: string) => void
  clearFkReference: () => void
  toggleDetailsPane: () => void

  // Selection actions
  setSelectedRowIndices: (indices: Set<number>) => void
  toggleRowSelection: (index: number) => void
  selectAllRows: (rowCount: number) => void
  clearSelection: () => void

  // Pagination actions
  setTotalRowCount: (count: number | null) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setLimitOffset: (limitOffset: { limit: number; offset: number } | null) => void
  resetPagination: () => void
}

export type TableTabStore = TableTabState & TableTabActions

function getRows(result: QueryResponse | null) {
  if (!result || !Array.isArray(result.result)) {
    return []
  }
  return result.result as Record<string, unknown>[]
}

function getColumnNames(result: QueryResponse | null, rows: Record<string, unknown>[]) {
  if (Array.isArray(result?.columns) && result?.columns?.length) {
    return result.columns.map((column) => column.name)
  }
  if (rows.length > 0) {
    return Object.keys(rows[0])
  }
  return []
}

export function createTableTabStore(initialFilters: Filter[] = [], initialFilterMode: 'all' | 'any' = 'all') {
  return create<TableTabStore>((set) => ({
    // Initial data state
    status: 'idle',
    result: null,
    error: null,
    rows: [],
    columnNames: [],

    // Initial filter state
    filters: initialFilters,
    rawSqlWhere: null,
    filterMode: initialFilterMode,

    // Initial details state
    detailsRow: null,
    detailsMode: 'row',
    fkReference: null,
    detailsLoading: false,
    detailsError: null,
    primaryKey: null,
    tableInfo: null,
    isDetailsPaneOpen: true,

    // Initial selection state
    selectedRowIndices: new Set<number>(),

    // Initial pagination state
    totalRowCount: null,
    pageSize: 200,
    currentPage: 0,
    limitOffset: null,

    // Data actions
    setDataLoading: () =>
      set({
        status: 'loading',
        error: null,
        result: null,
      }),

    setDataSuccess: (result) => {
      const rows = getRows(result)
      const columnNames = getColumnNames(result, rows)
      set({
        status: 'success',
        result,
        error: null,
        rows,
        columnNames,
        selectedRowIndices: new Set<number>(),
      })
    },

    setDataError: (error) =>
      set({
        status: 'error',
        error,
        result: null,
      }),

    updateStreamingData: (result) => {
      const rows = getRows(result)
      const columnNames = getColumnNames(result, rows)
      set({
        result,
        rows,
        columnNames,
      })
    },

    // Filter actions
    setFilters: (filters) => set({ filters }),

    setRawSqlWhere: (sql) => set({ rawSqlWhere: sql }),

    addFilter: (columns) => {
      const defaultColumn = columns[0]
      if (!defaultColumn) return

      const defaultOperator = getDefaultOperator(defaultColumn.category)

      const newFilter: Filter = {
        id: crypto.randomUUID(),
        column: defaultColumn.name,
        operator: defaultOperator,
        value: '',
      }
      set((state) => ({
        filters: [...state.filters, newFilter],
      }))
    },

    clearFilters: () => set({ filters: [], rawSqlWhere: null }),

    setFilterMode: (mode) => set({ filterMode: mode }),

    // Details actions
    setDetailsRow: (row, meta) =>
      set({
        detailsRow: row,
        detailsMode: 'row',
        fkReference: null,
        detailsLoading: false,
        detailsError: null,
        primaryKey: meta?.primaryKey ?? null,
        tableInfo: meta?.tableInfo ?? null,
      }),

    clearDetailsRow: () =>
      set({
        detailsRow: null,
        detailsMode: 'row',
        fkReference: null,
        detailsLoading: false,
        detailsError: null,
        primaryKey: null,
        tableInfo: null,
      }),

    setFkLoading: (ref) =>
      set({
        detailsMode: 'fk-reference',
        fkReference: ref,
        detailsRow: null,
        detailsLoading: true,
        detailsError: null,
      }),

    setFkReference: (ref, row) =>
      set({
        detailsMode: 'fk-reference',
        fkReference: ref,
        detailsRow: row,
        detailsLoading: false,
        detailsError: null,
      }),

    setFkError: (error) =>
      set({
        detailsLoading: false,
        detailsError: error,
      }),

    clearFkReference: () =>
      set({
        detailsRow: null,
        detailsMode: 'row',
        fkReference: null,
        detailsLoading: false,
        detailsError: null,
        primaryKey: null,
        tableInfo: null,
      }),

    toggleDetailsPane: () =>
      set((state) => ({
        isDetailsPaneOpen: !state.isDetailsPaneOpen,
      })),

    // Selection actions
    setSelectedRowIndices: (indices) => set({ selectedRowIndices: indices }),

    toggleRowSelection: (index) =>
      set((state) => {
        const newSet = new Set(state.selectedRowIndices)
        if (newSet.has(index)) {
          newSet.delete(index)
        } else {
          newSet.add(index)
        }
        return { selectedRowIndices: newSet }
      }),

    selectAllRows: (rowCount) =>
      set({
        selectedRowIndices: new Set(Array.from({ length: rowCount }, (_, i) => i)),
      }),

    clearSelection: () => set({ selectedRowIndices: new Set<number>() }),

    // Pagination actions
    setTotalRowCount: (count) => set({ totalRowCount: count }),

    setPage: (page) =>
      set((state) => ({
        currentPage: Math.max(0, page),
        // Clear limit/offset mode when using pagination
        limitOffset: null,
      })),

    setPageSize: (size) =>
      set((state) => ({
        pageSize: Math.max(1, Math.min(500, size)),
        // Reset to first page when changing page size
        currentPage: 0,
        // Clear limit/offset mode
        limitOffset: null,
      })),

    setLimitOffset: (limitOffset) =>
      set({
        limitOffset,
        // When entering limit/offset mode, clear pagination
        currentPage: 0,
      }),

    resetPagination: () =>
      set({
        currentPage: 0,
        pageSize: 200,
        limitOffset: null,
        totalRowCount: null,
      }),
  }))
}

export type TableTabStoreApi = ReturnType<typeof createTableTabStore>
