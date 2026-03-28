import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { HEADER_CELL_CLASS, HEADER_CELL_DRAGGING_CLASS } from './GridStyles'

type DraggableHeaderProps = {
  /** Unique identifier for this column (the column name) */
  id: string
  /** Content to render inside the header */
  children: ReactNode
  /** Optional additional className to merge */
  className?: string
}

/**
 * A table header cell (<th>) that can be dragged to reorder columns.
 * Must be used within a SortableContext.
 */
export function DraggableHeader({ id, children, className }: DraggableHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
  }

  const baseClass = isDragging ? HEADER_CELL_DRAGGING_CLASS : HEADER_CELL_CLASS
  const finalClass = className ? `${baseClass} ${className}` : baseClass

  return (
    <th ref={setNodeRef} style={style} className={finalClass} {...attributes} {...listeners}>
      {children}
    </th>
  )
}
