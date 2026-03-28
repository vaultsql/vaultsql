import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useCallback, useMemo, useRef } from 'react'
import { DraggableHeader } from './DraggableHeader'
import {
  DATA_CELL_CLASS,
  GRID_CONTAINER_CLASS,
  HEADER_CELL_CLASS,
  ROW_DEFAULT_CLASS,
  ROW_NUMBER_CELL_CLASS,
  ROW_NUMBER_HEADER_CLASS,
  TABLE_CLASS,
  TBODY_CLASS,
  THEAD_CLASS,
} from './GridStyles'
import type { BaseGridProps, GridColumn } from './types'
import { useColumnOrder } from './useColumnOrder'
import { useColumnResize } from './useColumnResize'
import { useGridSelection } from './useGridSelection'

/** Default cell value renderer */
function DefaultCellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">NULL</span>
  }

  if (typeof value === 'object') {
    return <span className="text-xs text-muted-foreground">{JSON.stringify(value)}</span>
  }

  return <span>{String(value)}</span>
}

/**
 * Base grid component with support for selection,
 * column reordering, column resizing, and context menus.
 */
export function BaseGrid<T extends Record<string, unknown>>({
  columns,
  rows,
  getRowKey,
  enableSelection = false,
  enableColumnReorder = false,
  enableColumnResize = false,
  storageKey,
  getRowClassName,
  onRowClick,
  onRowDoubleClick,
  selectedRows: controlledSelectedRows,
  onSelectionChange,
  renderRowPrefix,
  renderHeaderPrefix,
  appendRows,
}: BaseGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Derive column keys from column definitions
  const columnKeys = useMemo(() => columns.map((col) => col.key), [columns])

  // Row keys for selection
  const rowKeys = useMemo(() => rows.map((row, index) => getRowKey(row, index)), [rows, getRowKey])

  // Column ordering
  const { orderedColumns: orderedColumnKeys, reorder } = useColumnOrder(
    enableColumnReorder && storageKey ? storageKey : null,
    columnKeys,
  )

  // Get ordered column definitions
  const orderedColumns = useMemo(() => {
    const columnMap = new Map(columns.map((col) => [col.key, col]))
    return orderedColumnKeys
      .map((key) => columnMap.get(key))
      .filter((col): col is GridColumn<T> => col !== undefined)
  }, [columns, orderedColumnKeys])

  // Column resizing
  const { getColumnWidth, startResize, isResizing, resizingColumn } = useColumnResize({
    columnKeys,
    storageKey: enableColumnResize && storageKey ? `${storageKey}:widths` : undefined,
    initialWidths: Object.fromEntries(
      columns
        .filter((col) => typeof col.width === 'number')
        .map((col) => [col.key, col.width as number]),
    ),
  })

  // Selection
  const selection = useGridSelection({
    rowKeys,
    selectedRows: enableSelection ? controlledSelectedRows : undefined,
    onSelectionChange: enableSelection ? onSelectionChange : undefined,
  })

  // DnD sensors for column reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        reorder(String(active.id), String(over.id))
      }
    },
    [reorder],
  )

  // Handle row click
  const handleRowClick = useCallback(
    (row: T, index: number, event: React.MouseEvent) => {
      onRowClick?.(row, index, event)
    },
    [onRowClick],
  )

  // Handle row double click
  const handleRowDoubleClick = useCallback(
    (row: T, index: number, event: React.MouseEvent) => {
      onRowDoubleClick?.(row, index, event)
    },
    [onRowDoubleClick],
  )

  // Render column header with optional resize handle
  const renderColumnHeader = (column: GridColumn<T>, isDraggable: boolean) => {
    const width = getColumnWidth(column.key)
    const style = width ? { width: `${width}px`, minWidth: `${width}px` } : undefined

    const content = (
      <>
        {typeof column.header === 'string' ? column.header : column.header}
        {enableColumnResize && column.resizable !== false && (
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/50"
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              startResize(column.key, e.clientX)
            }}
          />
        )}
      </>
    )

    if (isDraggable) {
      return (
        <DraggableHeader
          key={column.key}
          id={column.key}
          className={enableColumnResize ? 'relative' : undefined}
          style={style}
        >
          {content}
        </DraggableHeader>
      )
    }

    return (
      <th
        key={column.key}
        className={`${HEADER_CELL_CLASS} ${enableColumnResize ? 'relative' : ''}`}
        style={style}
      >
        {content}
      </th>
    )
  }

  // Render cell content
  const renderCell = (column: GridColumn<T>, row: T, rowIndex: number) => {
    const value = row[column.key]

    if (column.renderCell) {
      return column.renderCell(value, row, rowIndex)
    }

    return <DefaultCellValue value={value} />
  }

  // Table content
  const tableContent = (
    <div ref={containerRef} className={`${GRID_CONTAINER_CLASS} ${isResizing ? 'select-none' : ''}`}>
      <table className={TABLE_CLASS}>
        <thead className={THEAD_CLASS}>
          <tr>
            {/* Prefix column (row number, checkbox, etc.) */}
            <th className={ROW_NUMBER_HEADER_CLASS}>
              {renderHeaderPrefix ? renderHeaderPrefix() : '#'}
            </th>
            {enableColumnReorder ? (
              <SortableContext items={orderedColumnKeys} strategy={horizontalListSortingStrategy}>
                {orderedColumns.map((column) => renderColumnHeader(column, true))}
              </SortableContext>
            ) : (
              orderedColumns.map((column) => renderColumnHeader(column, false))
            )}
          </tr>
        </thead>
        <tbody className={TBODY_CLASS}>
          {rows.map((row, rowIndex) => {
            const rowKey = getRowKey(row, rowIndex)
            const isSelected = enableSelection && selection.isSelected(rowKey)
            const customClassName = getRowClassName?.(row, rowIndex) ?? ''

            // Combine row classes
            let rowClassName = ROW_DEFAULT_CLASS
            if (customClassName) {
              rowClassName = customClassName
            } else if (isSelected) {
              rowClassName = 'bg-muted/50 transition-colors hover:bg-muted/70'
            }

            return (
              <tr
                key={rowKey}
                className={rowClassName}
                onClick={(e) => handleRowClick(row, rowIndex, e)}
                onDoubleClick={(e) => handleRowDoubleClick(row, rowIndex, e)}
              >
                {/* Prefix cell */}
                <td className={ROW_NUMBER_CELL_CLASS}>
                  {renderRowPrefix ? renderRowPrefix(row, rowIndex) : rowIndex + 1}
                </td>
                {orderedColumns.map((column) => {
                  const width = getColumnWidth(column.key)
                  const style = width ? { width: `${width}px`, minWidth: `${width}px` } : undefined

                  return (
                    <td
                      key={`${rowKey}-${column.key}`}
                      className={DATA_CELL_CLASS}
                      style={style}
                      title={String(row[column.key])}
                    >
                      {renderCell(column, row, rowIndex)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {appendRows}
        </tbody>
      </table>
    </div>
  )

  // Wrap with DndContext if column reordering is enabled
  if (enableColumnReorder) {
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {tableContent}
      </DndContext>
    )
  }

  return tableContent
}

// Re-export DefaultCellValue for use in custom cell renderers
export { DefaultCellValue as CellValue }
