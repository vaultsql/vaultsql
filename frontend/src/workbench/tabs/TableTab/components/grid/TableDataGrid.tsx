import clsx from 'clsx'
import { ExternalLink } from 'lucide-react'
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Checkbox } from '@/components/catalyst/checkbox'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import { RichCellEditor } from '../../../../components/editors'
import {
  CellValue,
  DATA_CELL_CLASS,
  DataGridCore,
  type GridColumnDef,
  type GridContextMenuConfig,
  ROW_DEFAULT_CLASS,
  ROW_NUMBER_CELL_CLASS,
  ROW_NUMBER_HEADER_CLASS,
} from '../../../../components/grid'
import { createTarget, isMutationType, type MutationEntry } from '../../../../lib/mutations/types'
import type { ColumnInfo, FilterInput, MutationColumnValue } from '../../../../types/database'
import { openTableTab } from '../../../controllers/openTableTab'
import {
  useTableTabActions,
  useTableTabContext,
  useTableTabMutations,
} from '../../state/TableTabContext'
import { EditCellDialog } from '../dialogs/EditCellDialog'
import { buildCellMenuItems, buildRowMenuItems } from './contextMenuBuilders'
import { formatClipboardValue, formatFilterValue } from './utils'

/**
 * Convert MutationColumnValue[] from an insert mutation to a display row.
 * Returns a Record with column names as keys and display values.
 */
function pendingRowToDisplayRow(
  values: MutationColumnValue[],
  columnNames: string[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const col of columnNames) {
    const mv = values.find((v) => v.column === col)
    if (!mv) {
      row[col] = null // Column not in insert, show null
    } else if (mv.isNull) {
      row[col] = null
    } else if (mv.useDefault) {
      row[col] = '(default)' // Display placeholder for server defaults
    } else {
      row[col] = mv.value
    }
  }
  return row
}

/**
 * Extract pending insert rows from mutation entries for a specific table.
 */
function getPendingInsertRows(
  entries: MutationEntry[],
  schema: string,
  table: string,
  columnNames: string[],
): { id: string; row: Record<string, unknown> }[] {
  const target = createTarget(schema, table)
  return entries
    .filter((entry) => isMutationType(entry, 'table.insert-row') && entry.target === target)
    .map((entry) => {
      if (!isMutationType(entry, 'table.insert-row')) {
        // Type guard - this shouldn't happen after filter
        return { id: entry.id, row: {} }
      }
      return {
        id: entry.id,
        row: pendingRowToDisplayRow(entry.payload.values, columnNames),
      }
    })
}

/**
 * Extract pending update edits from mutation entries for a specific table.
 * Returns a Map where keys are stringified primary key values and values are
 * objects mapping column names to their edited values.
 */
export function getPendingUpdateEdits(
  entries: MutationEntry[],
  schema: string,
  table: string,
): Map<string, Record<string, unknown>> {
  const target = createTarget(schema, table)
  const editsMap = new Map<string, Record<string, unknown>>()

  for (const entry of entries) {
    if (isMutationType(entry, 'table.update-row') && entry.target === target) {
      const pkValue = String(entry.payload.primaryKey.value)
      const existing = editsMap.get(pkValue) ?? {}
      for (const mv of entry.payload.values) {
        existing[mv.column] = mv.isNull ? null : mv.value
      }
      editsMap.set(pkValue, existing)
    }
  }

  return editsMap
}

/**
 * Extract primary key values of rows pending deletion for a specific table.
 * Returns a Set of stringified primary key values.
 */
export function getPendingDeletePks(
  entries: MutationEntry[],
  schema: string,
  table: string,
): Set<string> {
  const target = createTarget(schema, table)
  const deletePks = new Set<string>()

  for (const entry of entries) {
    if (isMutationType(entry, 'table.delete-row') && entry.target === target) {
      deletePks.add(String(entry.payload.primaryKey.value))
    }
  }

  return deletePks
}

export function TableDataGrid() {
  const { store, foreignKeys, columns: tableColumns, schema, table, canUpdateData } = useTableTabContext()
  const { db } = useWorkbench()
  const { applyFilters } = useTableTabActions()
  const mutations = useTableTabMutations()

  const rows = store((state) => state.rows)
  const columnNames = store((state) => state.columnNames)
  const setDetailsRow = store((state) => state.setDetailsRow)

  // Selection state from store
  const selectedRowIndices = store((state) => state.selectedRowIndices)
  const setSelectedRowIndices = store((state) => state.setSelectedRowIndices)
  const toggleRowSelection = store((state) => state.toggleRowSelection)
  const selectAllRows = store((state) => state.selectAllRows)
  const clearSelection = store((state) => state.clearSelection)

  // Ref to track the last-clicked row for Shift+click range selection
  const selectionAnchorRef = useRef<number | null>(null)
  const filters = store((state) => state.filters)
  const setFilters = store((state) => state.setFilters)
  const isFiltersOpen = store((state) => state.isFiltersOpen)
  const toggleFilters = store((state) => state.toggleFilters)

  const [detailsRowIndex, setDetailsRowIndex] = useState<number | null>(null)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null)
  const [editDialogCell, setEditDialogCell] = useState<{
    rowIndex: number
    column: ColumnInfo
    value: unknown
    pendingValue?: unknown
  } | null>(null)

  // Column reordering - use schema.table as storage key for persistence
  const storageKey = `table:${schema}.${table}`

  // Find primary key column if available
  const primaryKeyColumn = useMemo(
    () => tableColumns.find((col) => col.isPrimaryKey)?.name ?? null,
    [tableColumns],
  )

  const actionableColumns = useMemo(
    () => new Set(foreignKeys.map((fk) => fk.column)),
    [foreignKeys],
  )

  // Get pending insert rows for this table
  const pendingRows = useMemo(
    () => getPendingInsertRows(mutations.entries, schema, table, columnNames),
    [mutations.entries, schema, table, columnNames],
  )

  // Get pending update edits for this table
  const pendingUpdateEdits = useMemo(
    () => getPendingUpdateEdits(mutations.entries, schema, table),
    [mutations.entries, schema, table],
  )

  // Get pending delete primary keys for this table
  const pendingDeletePks = useMemo(
    () => getPendingDeletePks(mutations.entries, schema, table),
    [mutations.entries, schema, table],
  )

  // Reset details row when rows array identity changes
  const rowsIdentity = rows // Trigger effect when rows reference changes
  useEffect(() => {
    if (rowsIdentity.length >= 0) {
      setDetailsRowIndex(null)
    }
  }, [rowsIdentity])

  // Clear details and editing when multiple rows are selected
  const isMultiSelect = selectedRowIndices.size > 1
  useEffect(() => {
    if (isMultiSelect) {
      // Clear details pane
      setDetailsRowIndex(null)
      setDetailsRow(null)
      // Cancel any inline editing
      setEditingCell(null)
      setEditDialogCell(null)
    }
  }, [isMultiSelect, setDetailsRow])

  const handleShowDetails = useCallback(
    (index: number) => {
      // Don't show details when multiple rows are selected
      if (selectedRowIndices.size > 1) return

      const row = rows[index] ?? null
      setDetailsRowIndex(index)
      setDetailsRow(row, {
        primaryKey: primaryKeyColumn ? { column: primaryKeyColumn } : undefined,
        tableInfo: { schema, table },
      })
    },
    [rows, setDetailsRow, primaryKeyColumn, schema, table, selectedRowIndices.size],
  )

  const handleSelectAllChange = useCallback(() => {
    if (selectedRowIndices.size === rows.length && rows.length > 0) {
      clearSelection()
      selectionAnchorRef.current = null
    } else {
      selectAllRows(rows.length)
      selectionAnchorRef.current = null
    }
  }, [selectedRowIndices.size, rows.length, clearSelection, selectAllRows])

  // Handle checkbox click with Shift/Ctrl/Cmd modifiers
  const handleRowCheckboxClick = useCallback(
    (rowIndex: number, event: MouseEvent) => {
      const isShift = event.shiftKey
      const isCtrlOrMeta = event.ctrlKey || event.metaKey

      if (isShift && selectionAnchorRef.current !== null) {
        // Range selection: select all rows between anchor and current
        const anchor = selectionAnchorRef.current
        const start = Math.min(anchor, rowIndex)
        const end = Math.max(anchor, rowIndex)
        const newSelection = new Set(selectedRowIndices)
        for (let i = start; i <= end; i++) {
          newSelection.add(i)
        }
        setSelectedRowIndices(newSelection)
      } else if (isCtrlOrMeta) {
        // Toggle single row without changing anchor
        toggleRowSelection(rowIndex)
        // Update anchor to the toggled row
        selectionAnchorRef.current = rowIndex
      } else {
        // Normal click: toggle single row and set anchor
        toggleRowSelection(rowIndex)
        selectionAnchorRef.current = rowIndex
      }
    },
    [selectedRowIndices, setSelectedRowIndices, toggleRowSelection],
  )

  const getDisplayValue = useCallback(
    (row: Record<string, unknown>, columnName: string) => {
      if (!primaryKeyColumn) return row[columnName]
      const pkValue = row[primaryKeyColumn]
      if (pkValue === null || pkValue === undefined) return row[columnName]
      const rowEdits = pendingUpdateEdits.get(String(pkValue))
      if (rowEdits && columnName in rowEdits) {
        return rowEdits[columnName]
      }
      return row[columnName]
    },
    [pendingUpdateEdits, primaryKeyColumn],
  )

  const buildRowMutationValues = useCallback(
    (row: Record<string, unknown>): MutationColumnValue[] => {
      const values: MutationColumnValue[] = []
      for (const column of tableColumns) {
        if (column.isAutoIncrement || column.isGenerated) continue
        const value = getDisplayValue(row, column.name)
        if (value === undefined) continue
        values.push({
          column: column.name,
          value,
          isNull: value === null,
          useDefault: false,
        })
      }
      return values
    },
    [tableColumns, getDisplayValue],
  )

  const applyFilter = useCallback(
    (filter: FilterInput) => {
      const nextFilters = [...filters, { ...filter, id: crypto.randomUUID() }]
      setFilters(nextFilters)
      applyFilters(nextFilters.map(({ column, operator, value }) => ({ column, operator, value })))
      if (!isFiltersOpen) {
        toggleFilters()
      }
    },
    [applyFilters, filters, isFiltersOpen, setFilters, toggleFilters],
  )

  const handleColumnAction = useCallback(
    (column: string, row: Record<string, unknown>) => {
      const fk = foreignKeys.find((f) => f.column === column)
      if (!fk) return

      const value = row[column]
      if (value === null || value === undefined) return

      // Open the referenced table in a new tab with a filter
      openTableTab({
        schema: fk.refSchema,
        table: fk.refTable,
        filters: [{ column: fk.refColumn, operator: 'eq', value: String(value) }],
      })
    },
    [foreignKeys],
  )

  // Inline editing handlers
  const handleStartEdit = useCallback(
    (rowIndex: number, column: string) => {
      // Only allow editing if we have a primary key and not multi-selecting
      if (!canUpdateData) return
      if (!primaryKeyColumn) return
      if (selectedRowIndices.size > 1) return
      setEditingCell({ rowIndex, column })
    },
    [canUpdateData, primaryKeyColumn, selectedRowIndices.size],
  )

  const handleOpenEditDialog = useCallback(
    (rowIndex: number, columnInfo: ColumnInfo, row: Record<string, unknown>) => {
      if (!canUpdateData) return
      if (!primaryKeyColumn) return
      if (selectedRowIndices.size > 1) return
      setEditingCell(null)
      setEditDialogCell({
        rowIndex,
        column: columnInfo,
        value: row[columnInfo.name],
        pendingValue: getDisplayValue(row, columnInfo.name),
      })
    },
    [canUpdateData, getDisplayValue, primaryKeyColumn, selectedRowIndices.size],
  )

  const handleCellEdit = useCallback(
    (
      rowIndex: number,
      columnName: string,
      newValue: unknown,
      opts: { isNull?: boolean; useDefault?: boolean },
    ) => {
      if (!primaryKeyColumn) return

      const row = rows[rowIndex]
      if (!row) return

      const pkValue = row[primaryKeyColumn]
      const target = createTarget(schema, table)

      const mutationValue: MutationColumnValue = {
        column: columnName,
        value: newValue,
        isNull: opts.isNull ?? false,
        useDefault: opts.useDefault ?? false,
      }

      mutations.queue('table.update-row', target, {
        values: [mutationValue],
        primaryKey: { column: primaryKeyColumn, value: pkValue },
      })

      setEditingCell(null)
    },
    [primaryKeyColumn, rows, schema, table, mutations],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  const handleDialogSave = useCallback(
    (value: unknown, opts: { isNull?: boolean; useDefault?: boolean }) => {
      if (!editDialogCell) return
      handleCellEdit(editDialogCell.rowIndex, editDialogCell.column.name, value, opts)
      setEditDialogCell(null)
    },
    [editDialogCell, handleCellEdit],
  )

  // Reset editing state when rows change
  useEffect(() => {
    if (rows.length >= 0) {
      setEditingCell(null)
    }
  }, [rows.length])

  // Compute selection state for header checkbox
  const allSelected = rows.length > 0 && selectedRowIndices.size === rows.length
  const someSelected = selectedRowIndices.size > 0 && selectedRowIndices.size < rows.length

  const columns: GridColumnDef<Record<string, unknown>>[] = useMemo(
    () =>
      columnNames.map((column) => ({
        id: column,
        header: column,
        accessorKey: column,
        resizable: true,
        renderCell: ({ row, rowIndex }) => {
          const isActionable = actionableColumns?.has(column)
          const originalValue = row[column]
          const pkValue = primaryKeyColumn ? String(row[primaryKeyColumn]) : null
          const rowEdits = pkValue ? pendingUpdateEdits.get(pkValue) : undefined
          const hasPendingEdit = rowEdits !== undefined && column in rowEdits
          const displayValue = hasPendingEdit ? rowEdits?.[column] : originalValue
          const hasValue = displayValue !== null && displayValue !== undefined
          const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === column
          const columnInfo = tableColumns.find((col) => col.name === column)

          if (isEditing && columnInfo) {
            return (
              <RichCellEditor
                column={columnInfo}
                value={originalValue}
                pendingValue={hasPendingEdit ? displayValue : undefined}
                onSave={(value, opts) => handleCellEdit(rowIndex, column, value, opts)}
                onCancel={handleCancelEdit}
                compact={true}
              />
            )
          }

          if (isActionable && hasValue) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleColumnAction(column, row)
                }}
                className="inline-flex items-center gap-1 text-blue-400 hover:underline"
              >
                <CellValue value={displayValue} />
                <ExternalLink className="h-3 w-3 shrink-0" />
              </button>
            )
          }

          return <CellValue value={displayValue} />
        },
        getCellProps: ({ rowIndex }) => ({
          onDoubleClick: (event) => {
            event.stopPropagation()
            if (primaryKeyColumn && !actionableColumns?.has(column)) {
              handleStartEdit(rowIndex, column)
            }
          },
          onClick: (event) => {
            if (
              selectedRowIndices.has(rowIndex) &&
              primaryKeyColumn &&
              !actionableColumns?.has(column)
            ) {
              event.stopPropagation()
              handleStartEdit(rowIndex, column)
            }
          },
        }),
      })),
    [
      actionableColumns,
      columnNames,
      editingCell,
      handleCellEdit,
      handleCancelEdit,
      handleColumnAction,
      handleStartEdit,
      pendingUpdateEdits,
      primaryKeyColumn,
      selectedRowIndices,
      tableColumns,
    ],
  )

  const contextMenu = useMemo<GridContextMenuConfig<Record<string, unknown>>>(() => {
    return {
      getCellItems: ({ row, rowIndex, column }) => {
        const columnInfo = tableColumns.find((col) => col.name === column.id)
        const displayValue = getDisplayValue(row, column.id)

        return buildCellMenuItems({
          row,
          column,
          columnInfo,
          displayValue,
          primaryKeyColumn,
          actionableColumns,
          handleColumnAction,
          applyFilter,
          handleCellEdit,
          handleOpenEditDialog,
          rowIndex,
          canUpdateData,
        })
      },
      getRowItems: (row, rowIndex) => {
        return buildRowMenuItems({
          row,
          rowIndex,
          primaryKeyColumn,
          columnNames,
          schema,
          table,
          getDisplayValue,
          buildRowMutationValues,
          db,
          mutations,
          createTarget,
          canUpdateData,
        })
      },
    }
  }, [
    actionableColumns,
    applyFilter,
    buildRowMutationValues,
    canUpdateData,
    columnNames,
    db,
    getDisplayValue,
    handleCellEdit,
    handleColumnAction,
    handleOpenEditDialog,
    mutations,
    primaryKeyColumn,
    schema,
    table,
    tableColumns,
  ])

  return (
    <>
      <DataGridCore
        columns={columns}
        rows={rows}
        storageKey={storageKey}
        contextMenu={contextMenu}
        getRowKey={(row, rowIndex) => {
          const pkValue = primaryKeyColumn ? String(row[primaryKeyColumn]) : null
          return pkValue ?? `row-${rowIndex}`
        }}
        onRowClick={(row, rowIndex) => handleShowDetails(rowIndex)}
        rowClassName={(row, rowIndex) => {
          const pkValue = primaryKeyColumn ? String(row[primaryKeyColumn]) : null
          const isDetailsRow = detailsRowIndex === rowIndex
          const isChecked = selectedRowIndices.has(rowIndex)
          const isPendingDelete = pkValue ? pendingDeletePks.has(pkValue) : false

          if (isPendingDelete) return 'bg-rose-900/30 text-rose-100 transition-colors'
          if (isDetailsRow) return 'bg-indigo-900/30 text-indigo-100 transition-colors'
          if (isChecked) return 'bg-muted/50 transition-colors hover:bg-muted/70'
          return ROW_DEFAULT_CLASS
        }}
        cellClassName={({ row, rowIndex, column }) => {
          const pkValue = primaryKeyColumn ? String(row[primaryKeyColumn]) : null
          const rowEdits = pkValue ? pendingUpdateEdits.get(pkValue) : undefined
          const hasPendingEdit = rowEdits !== undefined && column.id in rowEdits
          const isPendingDelete = pkValue ? pendingDeletePks.has(pkValue) : false
          const isDetailsRow = detailsRowIndex === rowIndex
          const isChecked = selectedRowIndices.has(rowIndex)
          const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.column === column.id

          let cellBgClassName = 'bg-card'
          if (isPendingDelete) {
            cellBgClassName = 'bg-rose-900/30'
          } else if (isDetailsRow) {
            cellBgClassName = 'bg-indigo-900/30'
          } else if (isChecked) {
            cellBgClassName = 'bg-muted/50'
          }

          const cellEditClassName = hasPendingEdit && !isPendingDelete ? 'bg-amber-500/20' : ''
          return clsx(
            DATA_CELL_CLASS,
            cellBgClassName,
            cellEditClassName,
            isEditing && '!px-1 !py-0.5',
          )
        }}
        leadingColumn={{
          header: (
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAllChange}
              aria-label="Select all rows"
            />
          ),
          headerClassName: ROW_NUMBER_HEADER_CLASS,
          cellClassName: (row, rowIndex) => {
            const pkValue = primaryKeyColumn ? String(row[primaryKeyColumn]) : null
            const rowEdits = pkValue ? pendingUpdateEdits.get(pkValue) : undefined
            const hasRowEdits = rowEdits !== undefined && Object.keys(rowEdits).length > 0
            const isPendingDelete = pkValue ? pendingDeletePks.has(pkValue) : false
            const isDetailsRow = detailsRowIndex === rowIndex
            const isChecked = selectedRowIndices.has(rowIndex)

            if (isPendingDelete) return 'bg-rose-900/30'
            if (isDetailsRow) return 'bg-indigo-900/30'
            if (isChecked) return 'bg-muted/50'
            if (hasRowEdits) return 'bg-card'
            return 'bg-card'
          },
          render: (row, rowIndex) => {
            const pkValue = primaryKeyColumn ? String(row[primaryKeyColumn]) : null
            const rowEdits = pkValue ? pendingUpdateEdits.get(pkValue) : undefined
            const hasRowEdits = rowEdits !== undefined && Object.keys(rowEdits).length > 0
            const isPendingDelete = pkValue ? pendingDeletePks.has(pkValue) : false
            const isChecked = selectedRowIndices.has(rowIndex)

            if (isPendingDelete) {
              return <span className="text-rose-400 font-medium">&times;</span>
            }

            if (hasRowEdits) {
              return <span className="text-amber-400 font-medium">~</span>
            }

            return (
              <div
                onClick={(event) => {
                  event.stopPropagation()
                  handleRowCheckboxClick(rowIndex, event)
                }}
                onKeyDown={(event) => event.stopPropagation()}
                role="presentation"
              >
                <Checkbox
                  checked={isChecked}
                  onChange={() => {}}
                  aria-label={`Select row ${rowIndex + 1}`}
                />
              </div>
            )
          },
        }}
        renderTrailingRows={(orderedColumnIds) => {
          if (pendingRows.length === 0) return null
          return pendingRows.map((pending) => (
            <tr
              key={`pending-${pending.id}`}
              className="bg-emerald-900/30 text-emerald-100 transition-colors"
            >
              <td className={`${ROW_NUMBER_CELL_CLASS} bg-emerald-900/30`}>
                <span className="text-emerald-400 font-medium">+</span>
              </td>
              {orderedColumnIds.map((column) => {
                const cellValue = pending.row[column]
                return (
                  <td
                    key={`pending-${pending.id}-${column}`}
                    className={DATA_CELL_CLASS}
                    title={String(cellValue)}
                  >
                    <CellValue value={cellValue} />
                  </td>
                )
              })}
            </tr>
          ))
        }}
      />
      <EditCellDialog
        open={Boolean(editDialogCell)}
        onOpenChange={(open) => {
          if (!open) setEditDialogCell(null)
        }}
        column={editDialogCell?.column ?? null}
        value={editDialogCell?.value}
        pendingValue={editDialogCell?.pendingValue}
        onSave={handleDialogSave}
      />
    </>
  )
}
