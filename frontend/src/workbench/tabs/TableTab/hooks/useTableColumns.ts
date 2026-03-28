import type { ColumnInfo } from '@/workbench/types/database'
import { useColumnsStore } from '../../../features/schema-browser/useColumnsStore'

type UseTableColumnsParams = {
  schema: string
  table: string
}

const EMPTY_COLUMNS: ColumnInfo[] = []

export function useTableColumns({ schema, table }: UseTableColumnsParams) {
  const tableKey = `${schema}.${table}`
  const columns = useColumnsStore((state) => state.columns.get(tableKey))

  return columns ?? EMPTY_COLUMNS
}
