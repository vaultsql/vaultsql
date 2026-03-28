/**
 * Context menu item builders for TableDataGrid
 * Extracted to stable functions to reduce re-renders
 */

import type { GridCellContext, GridContextMenuItem } from '@/workbench/components/grid'
import type {
  ColumnInfo,
  FilterInput,
  ForeignKeyInfo,
  MutationColumnValue,
} from '@/workbench/types/database'
import { formatClipboardValue, formatFilterValue } from './utils'

type CellMenuBuilderParams = {
  row: Record<string, unknown>
  column: { id: string }
  columnInfo: ColumnInfo | undefined
  displayValue: unknown
  primaryKeyColumn: string | null
  actionableColumns: Set<string> | undefined
  handleColumnAction: (column: string, row: Record<string, unknown>) => void
  applyFilter: (filter: FilterInput) => void
  handleCellEdit: (
    rowIndex: number,
    column: string,
    value: unknown,
    opts: { isNull?: boolean; useDefault?: boolean },
  ) => void
  handleOpenEditDialog: (
    rowIndex: number,
    columnInfo: ColumnInfo,
    row: Record<string, unknown>,
  ) => void
  rowIndex: number
  canUpdateData: boolean
}

export function buildCellMenuItems({
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
}: CellMenuBuilderParams): GridContextMenuItem[] {
  const items: GridContextMenuItem[] = []
  const isNullish = displayValue === null || displayValue === undefined
  const canEditCell = canUpdateData && Boolean(primaryKeyColumn) && columnInfo && !columnInfo.isGenerated
  const hasDefault = columnInfo
    ? columnInfo.hasServerDefault || columnInfo.defaultValue !== null
    : false

  if (actionableColumns?.has(column.id)) {
    items.push({
      id: `open-reference:${column.id}`,
      label: 'Open referenced row',
      disabled: isNullish,
      onSelect: () => handleColumnAction(column.id, row),
    })
  }

  items.push({
    id: `copy-cell:${column.id}`,
    label: 'Copy cell value',
    onSelect: () => navigator.clipboard.writeText(formatClipboardValue(displayValue)),
  })

  items.push({
    id: `filter-eq:${column.id}`,
    label: isNullish ? 'Filter: IS NULL' : 'Filter: = value',
    onSelect: () =>
      applyFilter({
        column: column.id,
        operator: isNullish ? 'isNull' : 'eq',
        value: isNullish ? '' : formatFilterValue(displayValue),
      }),
  })

  items.push({
    id: `filter-null:${column.id}`,
    label: isNullish ? 'Filter: IS NOT NULL' : 'Filter: IS NULL',
    onSelect: () =>
      applyFilter({
        column: column.id,
        operator: isNullish ? 'isNotNull' : 'isNull',
        value: '',
      }),
  })

  if (primaryKeyColumn && columnInfo) {
    if (columnInfo.nullable) {
      items.push({
        id: `set-null:${column.id}`,
        label: 'Set NULL',
        disabled: !canEditCell || isNullish,
        onSelect: () => handleCellEdit(rowIndex, column.id, null, { isNull: true }),
      })
    }
    if (hasDefault) {
      items.push({
        id: `set-default:${column.id}`,
        label: 'Set default',
        disabled: !canEditCell,
        onSelect: () => handleCellEdit(rowIndex, column.id, null, { useDefault: true }),
      })
    }

    items.push({
      id: `edit-modal:${column.id}`,
      label: `Edit ${column.id}`,
      disabled: !canEditCell,
      onSelect: () => {
        if (!columnInfo) return
        handleOpenEditDialog(rowIndex, columnInfo, row)
      },
    })
  }

  return items
}

type RowMenuBuilderParams = {
  row: Record<string, unknown>
  rowIndex: number
  primaryKeyColumn: string | null
  columnNames: string[]
  schema: string
  table: string
  getDisplayValue: (row: Record<string, unknown>, columnName: string) => unknown
  buildRowMutationValues: (row: Record<string, unknown>) => MutationColumnValue[]
  db: {
    buildInsertQuery: (params: {
      schema: string
      table: string
      values: MutationColumnValue[]
    }) => { sql: string }
  }
  mutations: {
    queue: <T extends string>(type: T, target: string, payload: any) => void
  }
  createTarget: (schema: string, table: string) => string
  canUpdateData: boolean
}

export function buildRowMenuItems({
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
}: RowMenuBuilderParams): GridContextMenuItem[] {
  const pkValue = primaryKeyColumn ? row[primaryKeyColumn] : null
  const hasPkValue = pkValue !== null && pkValue !== undefined
  const rowWithEdits: Record<string, unknown> = {}
  for (const columnName of columnNames) {
    rowWithEdits[columnName] = getDisplayValue(row, columnName)
  }

  return [
    {
      id: 'copy-row-json',
      label: 'Copy row as JSON',
      onSelect: () => {
        try {
          const jsonStr = JSON.stringify(rowWithEdits, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v,
          )
          navigator.clipboard.writeText(jsonStr)
        } catch {
          navigator.clipboard.writeText(String(rowWithEdits))
        }
      },
    },
    {
      id: 'copy-row-insert',
      label: 'Copy row as INSERT',
      onSelect: () => {
        const values = buildRowMutationValues(row)
        const result = db.buildInsertQuery({ schema, table, values })
        navigator.clipboard.writeText(result.sql)
      },
    },
    {
      id: 'duplicate-row',
      label: 'Duplicate row',
      disabled: !canUpdateData,
      onSelect: () => {
        const values = buildRowMutationValues(row)
        const target = createTarget(schema, table)
        mutations.queue('table.insert-row', target, { values })
      },
    },
    {
      id: 'delete-row',
      label: 'Delete row',
      disabled: !canUpdateData || !primaryKeyColumn || !hasPkValue,
      danger: true,
      onSelect: () => {
        if (!primaryKeyColumn || !hasPkValue) return
        const target = createTarget(schema, table)
        mutations.queue('table.delete-row', target, {
          primaryKey: { column: primaryKeyColumn, value: pkValue },
        })
      },
    },
  ]
}
