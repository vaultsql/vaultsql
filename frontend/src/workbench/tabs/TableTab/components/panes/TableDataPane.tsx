import { SimpleSplit } from '@/workbench/components/SimpleSplit'
import { useTableTabContext } from '../../state/TableTabContext'
import { TableDataGrid } from '../grid/TableDataGrid'
import { DetailsPane } from './DetailsPane'

export function TableDataPane() {
  const { store, tab } = useTableTabContext()
  const status = store((state) => state.status)
  const rows = store((state) => state.rows)
  const error = store((state) => state.error)
  const filters = store((state) => state.filters)
  const isDetailsPaneOpen = store((state) => state.isDetailsPaneOpen)

  const tableName = tab.title
  const activeFilterCount = filters.length

  if ((status === 'loading' || status === 'idle') && rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm font-medium text-muted-foreground">
          Loading <span className="text-foreground">{tableName}</span>…
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm text-center text-sm text-rose-600">
          Failed to load <span className="font-semibold text-rose-700">{tableName}</span>
          <p className="mt-2 text-xs text-rose-500">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {activeFilterCount > 0
              ? 'No rows match the current filters.'
              : 'No rows returned for this table.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          {isDetailsPaneOpen ? (
            <SimpleSplit direction="horizontal" initialSizes={[70, 30]} minSizes={[30, 20]}>
              <TableDataGrid />
              <DetailsPane />
            </SimpleSplit>
          ) : (
            <TableDataGrid />
          )}
        </div>
      )}
    </div>
  )
}
