import { DataGridCore, type GridColumnDef } from './grid'

type DataGridProps = {
  columns: string[]
  rows: Record<string, unknown>[]
  /** Optional storage key for persisting column order. If not provided, reordering is disabled. */
  storageKey?: string
}

export function DataGrid({ columns, rows, storageKey }: DataGridProps) {
  const gridColumns: GridColumnDef<Record<string, unknown>>[] = columns.map((column) => ({
    id: column,
    header: column,
    accessorKey: column,
  }))

  return (
    <DataGridCore
      columns={gridColumns}
      rows={rows}
      storageKey={storageKey ?? null}
      leadingColumn={{
        header: '#',
        render: (_, rowIndex) => rowIndex + 1,
      }}
    />
  )
}
