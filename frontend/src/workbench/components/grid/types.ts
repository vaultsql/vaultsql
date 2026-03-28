import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export type GridColumnDef<T> = {
  id: string
  header: ReactNode | ((column: GridColumnDef<T>) => ReactNode)
  accessor?: (row: T) => unknown
  accessorKey?: keyof T & string
  renderCell?: (ctx: GridCellContext<T>) => ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  resizable?: boolean
  reorderable?: boolean
  className?: string
  headerClassName?: string
  cellClassName?: string | ((ctx: GridCellContext<T>) => string)
  getCellProps?: (ctx: GridCellContext<T>) => ComponentPropsWithoutRef<'td'>
  meta?: Record<string, unknown>
}

export type GridCellContext<T> = {
  row: T
  rowIndex: number
  column: GridColumnDef<T>
  columnIndex: number
  value: unknown
}

export type GridContextMenuItem = {
  id: string
  label: ReactNode
  onSelect?: () => void
  disabled?: boolean
  danger?: boolean
  shortcut?: string
  icon?: ReactNode
  separator?: boolean
}

export type GridContextMenuConfig<T> = {
  getRowItems?: (row: T, rowIndex: number) => GridContextMenuItem[]
  getCellItems?: (ctx: GridCellContext<T>) => GridContextMenuItem[]
  onOpen?: (ctx: { row: T; rowIndex: number; columnId?: string }) => void
}

export type GridLeadingColumn<T> = {
  header?: ReactNode
  headerClassName?: string
  cellClassName?: string | ((row: T, rowIndex: number) => string)
  render: (row: T, rowIndex: number) => ReactNode
}

export type GridTrailingColumn<T> = {
  header?: ReactNode
  headerClassName?: string
  cellClassName?: string | ((row: T, rowIndex: number) => string)
  render: (row: T, rowIndex: number) => ReactNode
}
