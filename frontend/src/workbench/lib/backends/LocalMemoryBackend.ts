import type {
  DatabaseInfo,
  ExportRunOptions,
  ExportRunResult,
  HistoryItem,
  QueryAudit,
  QueryResponse,
  StreamQueryHandlers,
  WorkbenchBackend,
  WorkbenchHistoryService,
  WorkbenchQueryService,
} from '@/workbench/types/database'

function withAuditParams(url: string, audit?: QueryAudit): string {
  if (!audit?.actor && !audit?.operation) {
    return url
  }
  const requestUrl = new URL(url)
  if (audit?.actor) {
    requestUrl.searchParams.set('actor', audit.actor)
  }
  if (audit?.operation) {
    requestUrl.searchParams.set('operation', audit.operation)
  }
  return requestUrl.toString()
}

class MemoryQueryService implements WorkbenchQueryService {
  async run(query: string, audit?: QueryAudit): Promise<QueryResponse> {
    try {
      const url = withAuditParams('http://localhost:8000/api/query/run', audit)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        throw new Error(`Query failed with status ${response.status}`)
      }

      const data = (await response.json()) as QueryResponse
      return data
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error executing query',
      }
    }
  }

  async streamQuery(
    query: string,
    handlers?: StreamQueryHandlers,
    audit?: QueryAudit,
  ): Promise<QueryResponse> {
    const response = await this.run(query, audit)
    if (response.success) {
      handlers?.onColumns?.(response.columns ?? [])
      if (Array.isArray(response.result)) {
        response.result.forEach((row) => handlers?.onRow?.(row as Record<string, unknown>))
      }
      handlers?.onComplete?.({
        rowCount: response.result?.length ?? 0,
        truncated: false,
      })
    } else {
      handlers?.onError?.(response.error ?? 'Failed to run query')
    }
    return response
  }

  async exportQuery(
    _query: string,
    _options: ExportRunOptions,
    _audit?: QueryAudit,
  ): Promise<ExportRunResult> {
    throw new Error('Export is not supported for the local memory backend.')
  }
}

class MemoryHistoryService implements WorkbenchHistoryService {
  private history: HistoryItem[] = []

  async list(): Promise<HistoryItem[]> {
    return [...this.history]
  }

  async add(item: HistoryItem): Promise<void> {
    this.history.unshift(item)
  }

  async clear(): Promise<void> {
    this.history = []
  }
}

export class LocalMemoryBackend implements WorkbenchBackend {
  public databaseId = 'database:primary'
  public database: DatabaseInfo

  public query = new MemoryQueryService()
  public history = new MemoryHistoryService()

  constructor(databaseType: 'postgres' | 'mysql' = 'postgres') {
    this.database = {
      name: 'VaultSQL Dev',
      type: databaseType,
      schema: 'public',
    }
  }
}
