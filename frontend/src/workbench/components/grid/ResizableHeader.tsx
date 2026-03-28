import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import {
  HEADER_CELL_CLASS,
  HEADER_CELL_DRAGGING_CLASS,
  RESIZE_HANDLE_CLASS,
  RESIZE_HANDLE_INDICATOR_CLASS,
} from './GridStyles'
import type { GridColumnDef } from './types'

type ResizableHeaderProps<T> = {
  column: GridColumnDef<T>
  children: ReactNode
  width?: number
  isResizing?: boolean
  onResizeStart?: (column: GridColumnDef<T>, startX: number) => void
  onAutoFit?: (column: GridColumnDef<T>) => void
}

export function ResizableHeader<T>({
  column,
  children,
  width,
  isResizing,
  onResizeStart,
  onAutoFit,
}: ResizableHeaderProps<T>) {
  const sortable = useSortable({
    id: column.id,
    disabled: column.reorderable === false,
  })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: column.reorderable === false ? 'default' : 'grab',
    width: width ? `${width}px` : undefined,
  }

  const baseClass = isDragging ? HEADER_CELL_DRAGGING_CLASS : HEADER_CELL_CLASS
  const finalClass = column.headerClassName ? `${baseClass} ${column.headerClassName}` : baseClass

  return (
    <th
      ref={setNodeRef}
      data-column-id={column.id}
      style={style}
      className={finalClass}
      {...attributes}
      {...listeners}
    >
      <span className="truncate pr-2">{children}</span>
      {column.resizable !== false && onResizeStart ? (
        <span
          className={RESIZE_HANDLE_CLASS}
          onPointerDown={(event) => {
            event.stopPropagation()
            event.preventDefault()
            // Capture pointer to prevent drag-and-drop interference
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
