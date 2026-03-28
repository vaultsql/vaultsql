import type { ReactNode } from 'react'
import type { components } from '@/lib/openapi'
import { DataGrid } from '../../components/DataGrid'

type QueryResponse = components['schemas']['QueryResponse']

type TabStatus = 'idle' | 'loading' | 'success' | 'error'

type QueryResultsPaneProps = {
  status: TabStatus
  error: string | null
  lastResponse: QueryResponse | null
}

export function QueryResultsPane({ status, error, lastResponse }: QueryResultsPaneProps) {
  let content: ReactNode = null

  if (status === 'idle') {
    content = (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Query results will appear here after you run a statement.
      </div>
    )
  } else if (status === 'loading') {
    content = (
      <div className="flex flex-1 items-center justify-center text-sm font-medium text-muted-foreground">
        Running query…
      </div>
    )
  } else if (status === 'error') {
    content = (
      <div className="flex flex-1 items-center justify-center p-3">
        <div className="rounded-md border border-rose-900/50 bg-rose-950/30 p-3 text-sm text-rose-400">
          Failed to run query.
          {error ? <p className="mt-1 text-xs text-rose-500">{error}</p> : null}
        </div>
      </div>
    )
  } else {
    const rows = getRows(lastResponse)
    const columns = getColumns(lastResponse, rows)

    if (rows.length === 0) {
      content = (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Query completed but returned no rows.
        </div>
      )
    } else {
      content = (
        <div className="flex min-h-0 flex-1 flex-col p-2">
          <div className="flex min-h-0 flex-1 rounded-md border border-border">
            <DataGrid columns={columns} rows={rows} />
          </div>
        </div>
      )
    }
  }

  return <div className="flex h-full flex-col">{content}</div>
}

function getRows(response: QueryResponse | null) {
  if (!response || !Array.isArray(response.result)) {
    return []
  }

  return response.result as Record<string, unknown>[]
}

function getColumns(response: QueryResponse | null, rows: Record<string, unknown>[]) {
  if (Array.isArray(response?.columns) && response?.columns?.length) {
    return response.columns.map((column) => column.name)
  }

  if (rows.length > 0) {
    return Object.keys(rows[0])
  }

  return []
}
