import {
  Copy,
  Download,
  FileCode,
  FileSpreadsheet,
  PanelRight,
  Plus,
  PlusCircle,
  RefreshCw,
  Star,
  TableIcon,
  Trash,
  Trash2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import {
  ToolbarButton,
  ToolbarDropdown,
  ToolbarDropdownButton,
  ToolbarDropdownItem,
  ToolbarDropdownMenu,
  ToolbarSeparator,
  ToolbarSplitButtonGroup,
} from '@/components/workbench'
import { MutationPreviewModal } from '@/workbench/components/MutationPreviewModal'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import { hydrateAllMutations } from '@/workbench/lib/mutations'
import { createTarget } from '@/workbench/lib/mutations/types'
import type { MutationColumnValue } from '@/workbench/types/database'
import { toFilterInputs } from '@/workbench/types/database'
import {
  useTableTabActions,
  useTableTabContext,
  useTableTabMutations,
} from '../../state/TableTabContext'
import { AddRowDialog } from '../dialogs/AddRowDialog'
import { DropTableModal } from '../dialogs/DropTableModal'
import { ExportDialog } from '../dialogs/ExportDialog'
import { TruncateTableModal } from '../dialogs/TruncateTableModal'
import { SaveButton } from './SaveButton'

export function TableToolbar() {
  const { tab, store, schema, table, columns, canUpdateData } = useTableTabContext()
  const { refresh } = useTableTabActions()
  const { db, starredStore } = useWorkbench()
  const mutations = useTableTabMutations()

  const [previewOpen, setPreviewOpen] = useState(false)
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [truncateDialogOpen, setTruncateDialogOpen] = useState(false)
  const [dropDialogOpen, setDropDialogOpen] = useState(false)

  const status = store((state) => state.status)
  const filters = store((state) => state.filters)
  const rows = store((state) => state.rows)
  const columnNames = store((state) => state.columnNames)
  
  // Derive activeFilters from filters (convert Filter[] to FilterInput[])
  const activeFilters = useMemo(() => toFilterInputs(filters), [filters])
  const selectedRowIndices = store((state) => state.selectedRowIndices)
  const clearSelection = store((state) => state.clearSelection)
  const isDetailsPaneOpen = store((state) => state.isDetailsPaneOpen)
  const toggleDetailsPane = store((state) => state.toggleDetailsPane)

  // Column names for export - prefer schema columns, fallback to data column names
  const exportColumnNames = useMemo(() => {
    if (columns.length > 0) {
      return columns.map((c) => c.name)
    }
    return columnNames
  }, [columns, columnNames])

  const isLoading = status === 'loading'

  // Find primary key column
  const primaryKeyColumn = columns.find((col) => col.isPrimaryKey)?.name ?? null
  const hasSelection = selectedRowIndices.size > 0
  const canDelete = hasSelection && primaryKeyColumn !== null

  // Star button logic
  const addTableStar = starredStore((state) => state.addTableStar)
  const addRowStar = starredStore((state) => state.addRowStar)
  const hasTableStar = starredStore((state) => state.hasTableStar)
  const hasRowStar = starredStore((state) => state.hasRowStar)
  const getTableStarId = starredStore((state) => state.getTableStarId)
  const getRowStarId = starredStore((state) => state.getRowStarId)
  const removeStar = starredStore((state) => state.removeStar)

  // Star button behavior:
  // - No selection: star the table
  // - Single row with PK: star the row
  // - Multiple rows: disabled
  let canStar = false
  let isStarred = false
  let starTooltip = 'Star table'
  let selectedRow: Record<string, unknown> | null = null

  if (selectedRowIndices.size === 0) {
    // No selection: star the table
    canStar = true
    isStarred = hasTableStar(schema, table)
    starTooltip = isStarred ? 'Unstar table' : 'Star table'
  } else if (selectedRowIndices.size === 1) {
    // Single row selected
    if (primaryKeyColumn) {
      // Has PK: star the row
      canStar = true
      const selectedIndex = Array.from(selectedRowIndices)[0]
      selectedRow = rows[selectedIndex] ?? null
      if (selectedRow) {
        const pkValue = String(selectedRow[primaryKeyColumn])
        isStarred = hasRowStar(schema, table, primaryKeyColumn, pkValue)
        starTooltip = isStarred ? 'Unstar row' : 'Star row'
      }
    } else {
      // No PK: can only star table
      canStar = true
      isStarred = hasTableStar(schema, table)
      starTooltip = isStarred ? 'Unstar table' : 'Star table'
    }
  } else {
    // Multiple rows selected: disabled
    canStar = false
    starTooltip = 'Select one row or none to star'
  }

  const handleToggleStar = useCallback(() => {
    if (!canStar) return

    if (selectedRowIndices.size === 0) {
      // Toggle table star
      if (isStarred) {
        const starId = getTableStarId(schema, table)
        if (starId) removeStar(starId)
      } else {
        addTableStar(schema, table)
      }
    } else if (selectedRowIndices.size === 1 && primaryKeyColumn && selectedRow) {
      // Toggle row star
      const pkValue = String(selectedRow[primaryKeyColumn])
      if (isStarred) {
        const starId = getRowStarId(schema, table, primaryKeyColumn, pkValue)
        if (starId) removeStar(starId)
      } else {
        addRowStar(schema, table, primaryKeyColumn, pkValue)
      }
    } else if (selectedRowIndices.size === 1) {
      // Single row but no PK: toggle table star
      if (isStarred) {
        const starId = getTableStarId(schema, table)
        if (starId) removeStar(starId)
      } else {
        addTableStar(schema, table)
      }
    }
  }, [
    canStar,
    selectedRowIndices,
    primaryKeyColumn,
    selectedRow,
    isStarred,
    schema,
    table,
    addTableStar,
    addRowStar,
    getTableStarId,
    getRowStarId,
    removeStar,
  ])

  // Hydrate mutations for preview modal
  const hydratedMutations = hydrateAllMutations(mutations.entries, db)

  const handleSave = async () => {
    const result = await mutations.commit()
    if (result.success) {
      refresh()
    }
    return result
  }

  const handlePreviewChanges = () => {
    setPreviewOpen(true)
  }

  const handleDiscardChanges = () => {
    mutations.clear()
  }

  const handleOpenAddRow = useCallback(() => {
    setAddRowDialogOpen(true)
  }, [])

  const handleAddRowSubmit = useCallback(
    (values: Record<string, unknown>) => {
      // Convert form values to MutationColumnValue[]
      const mutationValues: MutationColumnValue[] = []

      for (const [columnName, value] of Object.entries(values)) {
        const column = columns.find((c) => c.name === columnName)
        if (!column) continue

        mutationValues.push({
          column: columnName,
          value,
          isNull: value === null,
          useDefault: false,
        })
      }

      // Queue the insert mutation
      const target = createTarget(schema, table)
      mutations.queue('table.insert-row', target, { values: mutationValues })
    },
    [columns, schema, table, mutations],
  )

  const handleDeleteSelectedRows = useCallback(() => {
    if (!primaryKeyColumn) return

    const target = createTarget(schema, table)

    // Queue delete mutations for each selected row
    for (const rowIndex of selectedRowIndices) {
      const row = rows[rowIndex]
      if (!row) continue

      const pkValue = row[primaryKeyColumn]
      if (pkValue === null || pkValue === undefined) continue

      mutations.queue('table.delete-row', target, {
        primaryKey: { column: primaryKeyColumn, value: pkValue },
      })
    }

    // Clear selection after queuing deletions
    clearSelection()
  }, [primaryKeyColumn, schema, table, selectedRowIndices, rows, mutations, clearSelection])

  return (
    <div className="wb-toolbar">
      <div className="flex flex-1 items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          {/* Star */}
          <ToolbarButton
            icon={Star}
            title={starTooltip}
            onClick={handleToggleStar}
            disabled={!canStar}
            active={isStarred}
          />

          <ToolbarSeparator />

          {/* Refresh */}
          <ToolbarButton
            icon={RefreshCw}
            title="Refresh data"
            onClick={refresh}
            disabled={isLoading}
            className={isLoading ? '[&_svg]:animate-spin' : ''}
          />

          {/* Save - only show for tables */}
          {canUpdateData && (
            <SaveButton
              onSave={handleSave}
              onPreview={handlePreviewChanges}
              onDiscard={handleDiscardChanges}
              disabled={mutations.isEmpty}
              count={mutations.count}
            />
          )}

          {/* + Row: split button - main action adds row, dropdown has more options - only show for tables */}
          {canUpdateData && (
            <ToolbarSplitButtonGroup
              icon={Plus}
              label="Row"
              title="Add row"
              onClick={handleOpenAddRow}
            >
              <ToolbarDropdownMenu>
                <ToolbarDropdownItem onClick={handleOpenAddRow}>
                  <Plus data-slot="icon" />
                  Add Row
                </ToolbarDropdownItem>
                <ToolbarDropdownItem onClick={() => {}}>
                  <PlusCircle data-slot="icon" />
                  Add Multiple
                </ToolbarDropdownItem>
              </ToolbarDropdownMenu>
            </ToolbarSplitButtonGroup>
          )}

          {/* Truncate/Drop dropdown - only show for tables */}
          {canUpdateData && (
            <ToolbarDropdown>
              <ToolbarDropdownButton title="Table actions">
                <ToolbarButton icon={Trash2} hasDropdown />
              </ToolbarDropdownButton>
              <ToolbarDropdownMenu>
                <ToolbarDropdownItem onClick={() => setTruncateDialogOpen(true)}>
                  <Trash2 data-slot="icon" />
                  Truncate Table
                </ToolbarDropdownItem>
                <ToolbarDropdownItem onClick={() => setDropDialogOpen(true)}>
                  <TableIcon data-slot="icon" />
                  Drop Table
                </ToolbarDropdownItem>
              </ToolbarDropdownMenu>
            </ToolbarDropdown>
          )}

          <ToolbarSeparator />

          {/* Copy: split button - main action copies, dropdown has format options */}
          <ToolbarSplitButtonGroup
            icon={Copy}
            label="Copy"
            title="Copy selected rows"
            onClick={() => {}}
          >
            <ToolbarDropdownMenu>
              <ToolbarDropdownItem onClick={() => {}}>
                <FileCode data-slot="icon" />
                Copy as INSERT
              </ToolbarDropdownItem>
              <ToolbarDropdownItem onClick={() => {}}>
                <FileSpreadsheet data-slot="icon" />
                Copy as CSV
              </ToolbarDropdownItem>
            </ToolbarDropdownMenu>
          </ToolbarSplitButtonGroup>

          {/* Export */}
          <ToolbarButton
            icon={Download}
            label="Export"
            title="Export table data"
            onClick={() => setExportDialogOpen(true)}
          />

          {/* Delete - only show for tables */}
          {canUpdateData && (
            <ToolbarButton
              icon={Trash}
              label="Delete"
              title={
                canDelete
                  ? `Delete ${selectedRowIndices.size} selected row(s)`
                  : 'Select rows to delete'
              }
              disabled={!canDelete}
              onClick={handleDeleteSelectedRows}
            />
          )}
        </div>

        {/* Details button - right side */}
        <button
          type="button"
          onClick={toggleDetailsPane}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
            isDetailsPaneOpen
              ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title={isDetailsPaneOpen ? 'Hide details pane' : 'Show details pane'}
        >
          <PanelRight className="h-3.5 w-3.5" />
          Details
        </button>
      </div>

      <MutationPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        hydratedQueries={hydratedMutations}
        onRemove={mutations.remove}
        onClear={mutations.clear}
        onCommit={handleSave}
      />

      <AddRowDialog
        open={addRowDialogOpen}
        onClose={setAddRowDialogOpen}
        columns={columns}
        onSubmit={handleAddRowSubmit}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        schema={schema}
        table={table}
        columnNames={exportColumnNames}
        activeFilters={activeFilters}
        currentRowCount={rows.length}
      />

      <TruncateTableModal
        open={truncateDialogOpen}
        onClose={() => setTruncateDialogOpen(false)}
        schema={schema}
        table={table}
        onSuccess={refresh}
      />

      <DropTableModal
        open={dropDialogOpen}
        onClose={() => setDropDialogOpen(false)}
        schema={schema}
        table={table}
        tabId={tab.id}
      />
    </div>
  )
}
