import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import type { ColumnInfo, ForeignKeyInfo } from '@/workbench/types/database'
import { EditableCell } from '../EditableCell'
import { type FkExpandState, FkWell } from './FkWell'
import { CopyableValue, ForeignKeyCell } from './ValueDisplay'

type DetailsTableProps = {
  detailsRow: Record<string, unknown>
  columns: ColumnInfo[]
  foreignKeys: ForeignKeyInfo[]
  pendingEdits: Record<string, unknown>
  canEdit: boolean
  onCellEdit: (column: string, value: unknown) => void
}

/**
 * Table displaying row details with column names and values.
 * Supports editing (when canEdit=true), foreign key expansion, and copy actions.
 */
export function DetailsTable({
  detailsRow,
  columns,
  foreignKeys,
  pendingEdits,
  canEdit,
  onCellEdit,
}: DetailsTableProps) {
  const { db } = useWorkbench()

  // Track expanded FK columns: Map<columnName, { row, loading, error }>
  const [expandedFks, setExpandedFks] = useState<Map<string, FkExpandState>>(new Map())

  // Reset expanded FKs when the row changes
  useEffect(() => {
    // Reference detailsRow to satisfy the linter - we want to reset when any row change occurs
    if (detailsRow) {
      setExpandedFks(new Map())
    }
  }, [detailsRow])

  // Build a map of column name -> ColumnInfo for quick lookup
  const columnMap = useMemo(() => {
    const map = new Map<string, ColumnInfo>()
    for (const col of columns) {
      map.set(col.name, col)
    }
    return map
  }, [columns])

  // Build a map of column name -> ForeignKeyInfo for quick lookup
  const fkMap = useMemo(() => {
    const map = new Map<string, ForeignKeyInfo>()
    for (const fk of foreignKeys) {
      map.set(fk.column, fk)
    }
    return map
  }, [foreignKeys])

  const handleToggleFk = useCallback(
    async (columnName: string, fk: ForeignKeyInfo, value: unknown) => {
      // If already expanded, collapse it
      if (expandedFks.has(columnName)) {
        setExpandedFks((prev) => {
          const next = new Map(prev)
          next.delete(columnName)
          return next
        })
        return
      }

      // Set loading state
      setExpandedFks((prev) => {
        const next = new Map(prev)
        next.set(columnName, { row: null, loading: true, error: null })
        return next
      })

      try {
        const fetchedRow = await db.fetchRow({
          schema: fk.refSchema,
          table: fk.refTable,
          column: fk.refColumn,
          value,
        })

        setExpandedFks((prev) => {
          const next = new Map(prev)
          next.set(columnName, { row: fetchedRow, loading: false, error: null })
          return next
        })
      } catch (err) {
        setExpandedFks((prev) => {
          const next = new Map(prev)
          next.set(columnName, {
            row: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch row',
          })
          return next
        })
      }
    },
    [expandedFks, db],
  )

  return (
    <table className="min-w-full text-left text-sm">
      <tbody className="divide-y divide-border">
        {Object.entries(detailsRow).map(([columnName, value]) => {
          const columnInfo = columnMap.get(columnName)
          const pendingValue = pendingEdits[columnName]
          const hasPendingEdit = columnName in pendingEdits
          const fk = fkMap.get(columnName)
          const isFk = fk !== undefined
          const fkState = expandedFks.get(columnName)
          const isExpanded = fkState !== undefined

          return (
            <Fragment key={columnName}>
              <tr className="group hover:bg-muted/50">
                <td className="w-1/3 min-w-[100px] max-w-[180px] select-text break-words px-3 py-2 align-top text-xs font-medium text-muted-foreground">
                  <span className="break-words" title={columnName}>
                    {columnName}
                  </span>
                </td>
                <td className="w-2/3 select-text break-words px-3 py-2 font-mono text-xs text-foreground">
                  {isFk && value !== null && value !== undefined ? (
                    <ForeignKeyCell
                      value={value}
                      fk={fk}
                      isExpanded={isExpanded}
                      onToggle={() => handleToggleFk(columnName, fk, value)}
                    />
                  ) : canEdit && columnInfo ? (
                    <EditableCell
                      column={columnInfo}
                      value={value}
                      pendingValue={hasPendingEdit ? pendingValue : undefined}
                      onEdit={onCellEdit}
                    />
                  ) : (
                    <CopyableValue value={value} category={columnInfo?.category ?? 'other'} />
                  )}
                </td>
              </tr>
              {isExpanded && fkState && fk && <FkWell fk={fk} state={fkState} />}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
