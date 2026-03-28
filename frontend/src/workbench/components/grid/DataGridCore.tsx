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
import clsx from 'clsx'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { CellValue } from './CellValue'
import { GridContextMenu } from './GridContextMenu'
import {
  DATA_CELL_CLASS,
  GRID_CONTAINER_CLASS,
  HEADER_CELL_CLASS,
  RESIZE_HANDLE_CLASS,
  RESIZE_HANDLE_INDICATOR_CLASS,
  ROW_DEFAULT_CLASS,
  ROW_NUMBER_CELL_CLASS,
  ROW_NUMBER_HEADER_CLASS,
  TABLE_CLASS,
  TBODY_CLASS,
  THEAD_CLASS,
} from './GridStyles'
import { ResizableHeader } from './ResizableHeader'
import type {
  GridCellContext,
  GridColumnDef,
  GridContextMenuConfig,
  GridContextMenuItem,
  GridLeadingColumn,
  GridTrailingColumn,
} from './types'
import { useColumnOrder } from './useColumnOrder'
import { useColumnSizing } from './useColumnSizing'

type DataGridCoreProps<T> = {
  columns: GridColumnDef<T>[]
  rows: T[]
  storageKey?: string | null
  contextMenu?: GridContextMenuConfig<T>
  getRowKey?: (row: T, rowIndex: number) => string
  rowClassName?: string | ((row: T, rowIndex: number) => string)
  cellClassName?: string | ((ctx: GridCellContext<T>) => string)
  onRowClick?: (row: T, rowIndex: number) => void
  onRowDoubleClick?: (row: T, rowIndex: number) => void
  leadingColumn?: GridLeadingColumn<T>
  trailingColumn?: GridTrailingColumn<T>
  renderTrailingRows?: (columnIds: string[]) => ReactNode
}

function getCellValue<T>(row: T, column: GridColumnDef<T>) {
  if (column.accessor) return column.accessor(row)
  if (column.accessorKey) return row[column.accessorKey]
  if (typeof row === 'object' && row !== null && column.id in (row as Record<string, unknown>)) {
    return (row as Record<string, unknown>)[column.id]
  }
  return undefined
}

function PlainHeaderCell<T>({
  column,
  width,
  isResizing,
  onResizeStart,
  onAutoFit,
}: {
  column: GridColumnDef<T>
  width?: number
  isResizing?: boolean
  onResizeStart?: (column: GridColumnDef<T>, startX: number) => void
  onAutoFit?: (column: GridColumnDef<T>) => void
}) {
  return (
    <th
      data-column-id={column.id}
      className={
        column.headerClassName
          ? `${HEADER_CELL_CLASS} ${column.headerClassName}`
          : HEADER_CELL_CLASS
      }
      style={{ width: width ? `${width}px` : undefined }}
    >
      <span className="truncate pr-2">
        {typeof column.header === 'function' ? column.header(column) : column.header}
      </span>
      {column.resizable !== false && onResizeStart ? (
        <span
          className={RESIZE_HANDLE_CLASS}
          onPointerDown={(event) => {
            event.stopPropagation()
            event.preventDefault()
            // Capture pointer to prevent interference from other handlers
            ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
            onResizeStart(column, event.clientX)
          }}
          onDoubleClick={(event) => {
            event.stopPropagation()
            event.preventDefault()
            onAutoFit?.(column)
          }}
          role="presentation"
        >
          <span
            className={
              isResizing
                ? 'absolute right-0 top-1 bottom-1 w-0.5 rounded-full bg-blue-500'
                : RESIZE_HANDLE_INDICATOR_CLASS
            }
          />
        </span>
      ) : null}
    </th>
  )
}

export function DataGridCore<T>({
  columns,
  rows,
  storageKey = null,
  contextMenu,
  getRowKey,
  rowClassName,
  cellClassName,
  onRowClick,
  onRowDoubleClick,
  leadingColumn,
  trailingColumn,
  renderTrailingRows,
}: DataGridCoreProps<T>) {
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns])
  const { orderedColumns, reorder } = useColumnOrder(storageKey, columnIds)
  const orderedDefs = useMemo(() => {
    const lookup = new Map(columns.map((col) => [col.id, col]))
    return orderedColumns.map((id) => lookup.get(id)).filter(Boolean) as GridColumnDef<T>[]
  }, [columns, orderedColumns])

  const allowReorder = Boolean(storageKey)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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

  const { columnStyles, startResize, getWidth, setColumnWidth, isResizing, resizingColumnId } =
    useColumnSizing({
      columns: orderedDefs,
      storageKey,
    })

  // Reference to the table for auto-fit measurements
  const tableRef = useRef<HTMLTableElement>(null)

  // Auto-fit column width by measuring cell content
  const handleAutoFit = useCallback(
    (column: GridColumnDef<T>) => {
      if (!tableRef.current) return

      // Find all cells in this column and measure their content width
      const cells = tableRef.current.querySelectorAll(`td[data-column-id="${column.id}"]`)
      const headerCell = tableRef.current.querySelector(`th[data-column-id="${column.id}"]`)

      let maxWidth = 50 // minimum width

      // Measure header text
      if (headerCell) {
        const headerText = headerCell.querySelector('span')
        if (headerText) {
          maxWidth = Math.max(maxWidth, headerText.scrollWidth + 32) // padding
        }
      }

      // Measure each cell content
      cells.forEach((cell) => {
        const content = cell.firstElementChild
        if (content) {
          maxWidth = Math.max(maxWidth, content.scrollWidth + 32) // padding
        } else {
          maxWidth = Math.max(maxWidth, cell.scrollWidth)
        }
      })

      // Clamp to reasonable bounds
      const finalWidth = Math.min(500, Math.max(50, maxWidth))
      setColumnWidth(column.id, finalWidth)
    },
    [setColumnWidth],
  )

  const [menuState, setMenuState] = useState<{
    items: GridContextMenuItem[]
    position: { x: number; y: number } | null
  }>({ items: [], position: null })

  const openMenu = useCallback(
    (items: GridContextMenuItem[], position: { x: number; y: number }) => {
      setMenuState({ items, position })
    },
    [],
  )

  const closeMenu = useCallback(() => {
    setMenuState({ items: [], position: null })
  }, [])

  const body = (
    <tbody className={TBODY_CLASS}>
      {rows.map((row, rowIndex) => {
        const key = getRowKey ? getRowKey(row, rowIndex) : String(rowIndex)
        const rowClass =
          typeof rowClassName === 'function'
            ? rowClassName(row, rowIndex)
            : (rowClassName ?? ROW_DEFAULT_CLASS)

        return (
          <tr
            key={key}
            className={rowClass}
            onClick={() => onRowClick?.(row, rowIndex)}
            onDoubleClick={() => onRowDoubleClick?.(row, rowIndex)}
          >
            {leadingColumn ? (
              <td
                className={clsx(
                  ROW_NUMBER_CELL_CLASS,
                  typeof leadingColumn.cellClassName === 'function'
                    ? leadingColumn.cellClassName(row, rowIndex)
                    : leadingColumn.cellClassName,
                )}
              >
                {leadingColumn.render(row, rowIndex)}
              </td>
            ) : null}
            {orderedDefs.map((column, columnIndex) => {
              const value = getCellValue(row, column)
              const ctx: GridCellContext<T> = { row, rowIndex, column, columnIndex, value }
              const extraProps = column.getCellProps?.(ctx)
              const content = column.renderCell ? (
                column.renderCell(ctx)
              ) : (
                <CellValue value={value} />
              )
              const cellClass =
                typeof cellClassName === 'function'
                  ? cellClassName(ctx)
                  : (cellClassName ?? DATA_CELL_CLASS)
              const columnCellClass =
                typeof column.cellClassName === 'function'
                  ? column.cellClassName(ctx)
                  : column.cellClassName

              const handleContextMenu = (event: ReactMouseEvent<HTMLTableCellElement>) => {
                extraProps?.onContextMenu?.(event)
                if (event.defaultPrevented || !contextMenu) return
                event.preventDefault()
                const cellItems = contextMenu.getCellItems?.(ctx) ?? []
                const rowItems = contextMenu.getRowItems?.(row, rowIndex) ?? []
                const items = [...cellItems]
                if (cellItems.length > 0 && rowItems.length > 0) {
                  items.push({
                    id: 'separator:row',
                    label: '',
                    separator: true,
                  })
                }
                items.push(...rowItems)
                if (items.length === 0) return
                contextMenu.onOpen?.({ row, rowIndex, columnId: column.id })
                openMenu(items, { x: event.clientX, y: event.clientY })
              }

              const handleClick = (event: ReactMouseEvent<HTMLTableCellElement>) => {
                extraProps?.onClick?.(event)
              }

              const handleDoubleClick = (event: ReactMouseEvent<HTMLTableCellElement>) => {
                extraProps?.onDoubleClick?.(event)
              }

              return (
                <td
                  key={`${rowIndex}-${column.id}`}
                  {...extraProps}
                  data-column-id={column.id}
                  className={clsx(cellClass, columnCellClass, extraProps?.className)}
                  title={
                    typeof value === 'string' || typeof value === 'number'
                      ? String(value)
                      : undefined
                  }
                  onContextMenu={handleContextMenu}
                  onClick={handleClick}
                  onDoubleClick={handleDoubleClick}
                >
                  {content}
                </td>
              )
            })}
            {trailingColumn ? (
              <td
                className={clsx(
                  DATA_CELL_CLASS,
                  typeof trailingColumn.cellClassName === 'function'
                    ? trailingColumn.cellClassName(row, rowIndex)
                    : trailingColumn.cellClassName,
                )}
              >
                {trailingColumn.render(row, rowIndex)}
              </td>
            ) : null}
          </tr>
        )
      })}
      {renderTrailingRows ? renderTrailingRows(orderedDefs.map((col) => col.id)) : null}
    </tbody>
  )

  const table = (
    <div className={clsx(GRID_CONTAINER_CLASS, isResizing && 'select-none')}>
      <table ref={tableRef} className={TABLE_CLASS}>
        <colgroup>
          {leadingColumn ? <col style={{ width: 52 }} /> : null}
          {columnStyles.map((col) => (
            <col key={col.id} style={{ width: col.width ? `${col.width}px` : undefined }} />
          ))}
          {trailingColumn ? <col style={{ width: 52 }} /> : null}
        </colgroup>
        <thead className={THEAD_CLASS}>
          <tr>
            {leadingColumn ? (
              <th className={leadingColumn.headerClassName ?? ROW_NUMBER_HEADER_CLASS}>
                {leadingColumn.header}
              </th>
            ) : null}
            {allowReorder ? (
              <SortableContext
                items={orderedDefs.map((col) => col.id)}
                strategy={horizontalListSortingStrategy}
              >
                {orderedDefs.map((column) => (
                  <ResizableHeader
                    key={column.id}
                    column={column}
                    width={getWidth(column.id)}
                    isResizing={resizingColumnId === column.id}
                    onResizeStart={startResize}
                    onAutoFit={handleAutoFit}
                  >
                    {typeof column.header === 'function' ? column.header(column) : column.header}
                  </ResizableHeader>
                ))}
              </SortableContext>
            ) : (
              orderedDefs.map((column) => (
                <PlainHeaderCell
                  key={column.id}
                  column={column}
                  width={getWidth(column.id)}
                  isResizing={resizingColumnId === column.id}
                  onResizeStart={startResize}
                  onAutoFit={handleAutoFit}
                />
              ))
            )}
            {trailingColumn ? (
              <th className={trailingColumn.headerClassName ?? HEADER_CELL_CLASS}>
                {trailingColumn.header}
              </th>
            ) : null}
          </tr>
        </thead>
        {body}
      </table>
      <GridContextMenu
        isOpen={menuState.items.length > 0}
        items={menuState.items}
        position={menuState.position}
        onClose={closeMenu}
      />
    </div>
  )

  if (!allowReorder) return table

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {table}
    </DndContext>
  )
}
