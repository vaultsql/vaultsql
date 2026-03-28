import { Check, Copy, ExternalLink, Star, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import { createTarget } from '@/workbench/lib/mutations/types'
import type { MutationColumnValue } from '@/workbench/types/database'
import { openTableTab } from '../../../controllers/openTableTab'
import { useTableTabContext, useTableTabMutations } from '../../state/TableTabContext'
import { getPendingUpdateEdits } from '../grid/TableDataGrid'
import { safeStringify } from '../grid/utils'
import { DetailsTable } from './details'
import { formatKeyDisplay } from './details/formatters'

export function DetailsPane() {
  const { store, columns, foreignKeys, schema, table, canUpdateData } = useTableTabContext()
  const { starredStore } = useWorkbench()
  const mutations = useTableTabMutations()

  const detailsRow = store((state) => state.detailsRow)
  const mode = store((state) => state.detailsMode)
  const fkReference = store((state) => state.fkReference)
  const isLoading = store((state) => state.detailsLoading)
  const error = store((state) => state.detailsError)
  const primaryKey = store((state) => state.primaryKey)
  const tableInfo = store((state) => state.tableInfo)
  const setDetailsRow = store((state) => state.setDetailsRow)
  const clearFkReference = store((state) => state.clearFkReference)

  const handleClose = () => {
    if (mode === 'fk-reference') {
      clearFkReference()
    } else {
      setDetailsRow(null)
    }
  }

  const getTitle = () => {
    if (mode === 'fk-reference' && fkReference) {
      return formatKeyDisplay(fkReference.table, fkReference.column, fkReference.value)
    }
    if (mode === 'row' && tableInfo && primaryKey && detailsRow) {
      const pkValue = detailsRow[primaryKey.column]
      if (pkValue !== null && pkValue !== undefined) {
        return formatKeyDisplay(tableInfo.table, primaryKey.column, pkValue)
      }
    }
    return 'Row Details'
  }

  const title = getTitle()
  const showPkSqlCopy = mode === 'row' && tableInfo && primaryKey && detailsRow

  // Get pending edits for this table from mutation queue
  const pendingEdits = useMemo(
    () => getPendingUpdateEdits(mutations.entries, schema, table),
    [mutations.entries, schema, table],
  )

  // Get pending edits for the current row (if we have a primary key)
  const rowPendingEdits = useMemo(() => {
    if (!primaryKey || !detailsRow) return {}
    const pkValue = String(detailsRow[primaryKey.column])
    return pendingEdits.get(pkValue) ?? {}
  }, [pendingEdits, primaryKey, detailsRow])

  // Handler to queue an update mutation for a cell edit
  const handleCellEdit = useCallback(
    (columnName: string, newValue: unknown, opts?: { isNull?: boolean; useDefault?: boolean }) => {
      if (!primaryKey || !detailsRow) return

      const pkValue = detailsRow[primaryKey.column]
      const target = createTarget(schema, table)

      const mutationValue: MutationColumnValue = {
        column: columnName,
        value: newValue,
        isNull: opts?.isNull ?? newValue === null,
        useDefault: opts?.useDefault ?? false,
      }

      mutations.queue('table.update-row', target, {
        values: [mutationValue],
        primaryKey: { column: primaryKey.column, value: pkValue },
      })
    },
    [primaryKey, detailsRow, schema, table, mutations],
  )

  // Check if editing is allowed (only for 'row' mode with a primary key and update permissions)
  const canEdit = canUpdateData && mode === 'row' && primaryKey !== null

  // Star button logic for details pane
  const addRowStar = starredStore((state) => state.addRowStar)
  const hasRowStar = starredStore((state) => state.hasRowStar)
  const getRowStarId = starredStore((state) => state.getRowStarId)
  const removeStar = starredStore((state) => state.removeStar)

  const canStarRow = mode === 'row' && primaryKey && detailsRow
  let isRowStarred = false
  if (canStarRow) {
    const pkValue = String(detailsRow[primaryKey.column])
    isRowStarred = hasRowStar(schema, table, primaryKey.column, pkValue)
  }

  const handleToggleRowStar = useCallback(() => {
    if (!canStarRow || !primaryKey || !detailsRow) return

    const pkValue = String(detailsRow[primaryKey.column])

    if (isRowStarred) {
      const starId = getRowStarId(schema, table, primaryKey.column, pkValue)
      if (starId) removeStar(starId)
    } else {
      addRowStar(schema, table, primaryKey.column, pkValue)
    }
  }, [
    canStarRow,
    primaryKey,
    detailsRow,
    isRowStarred,
    schema,
    table,
    addRowStar,
    getRowStarId,
    removeStar,
  ])

  // If no row is selected, show empty state
  if (!detailsRow && !fkReference) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-card">
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">Select a row to view details</p>
        </div>
      </div>
    )
  }

  // Determine actions based on mode
  const showCopySql = (mode === 'row' && showPkSqlCopy) || (mode === 'fk-reference' && fkReference)
  const showOpenTable = mode === 'fk-reference' && fkReference
  const showStarButton = mode === 'row' && canStarRow

  const copySqlProps =
    mode === 'row' && tableInfo && primaryKey && detailsRow
      ? {
          schema: tableInfo.schema,
          table: tableInfo.table,
          column: primaryKey.column,
          value: detailsRow[primaryKey.column],
        }
      : fkReference
        ? fkReference
        : null

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Unified header with title and actions */}
      <div className="flex flex-row items-center gap-2 border-b border-border px-4 py-3">
        <h3 className="font-mono text-sm text-foreground flex-1 truncate" title={title}>
          {title}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {showStarButton && (
            <Button
              plain
              onClick={handleToggleRowStar}
              title={isRowStarred ? 'Unstar row' : 'Star row'}
              className={isRowStarred ? 'text-amber-500' : ''}
            >
              <Star className={`h-4 w-4 ${isRowStarred ? 'fill-current' : ''}`} />
            </Button>
          )}
          {showCopySql && copySqlProps && <CopySqlButton {...copySqlProps} />}
          {showOpenTable && fkReference && (
            <Button
              plain
              onClick={() => {
                openTableTab({
                  schema: fkReference.schema,
                  table: fkReference.table,
                  filters: [
                    {
                      column: fkReference.column,
                      operator: 'eq',
                      value: String(fkReference.value),
                    },
                  ],
                })
                handleClose()
              }}
              title="Open table"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Button plain onClick={handleClose} title="Close details pane">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-rose-500">{error}</p>
          </div>
        ) : detailsRow ? (
          <DetailsTable
            detailsRow={detailsRow}
            columns={columns}
            foreignKeys={foreignKeys}
            pendingEdits={rowPendingEdits}
            canEdit={canEdit}
            onCellEdit={handleCellEdit}
          />
        ) : mode === 'fk-reference' ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">No matching row found</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type RowReference = {
  schema: string
  table: string
  column: string
  value: unknown
}

function CopySqlButton({ schema, table, column, value }: RowReference) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const escapedValue = typeof value === 'string' ? `'${value}'` : value
    const query = `SELECT * FROM ${schema}.${table} WHERE ${column} = ${escapedValue}`
    navigator.clipboard.writeText(query)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button plain onClick={handleCopy} title="Copy SQL query">
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}
