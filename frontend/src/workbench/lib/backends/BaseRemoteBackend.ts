import type { Client } from 'openapi-fetch'
import { getQueryServiceUrl } from '@/lib/endpoints'
import type { paths } from '@/lib/openapi'
import type {
  DatabaseInfo,
  ExportRunOptions,
  ExportRunResult,
  HistoryItem,
  QueryAudit,
  QueryResponse,
  StreamQueryHandlers,
  WorkbenchBackend,
} from '@/workbench/types/database'

type DecryptedKeys = {
  databaseKey: Record<string, unknown>
  accountKey: Record<string, unknown>
}

export type GetToken = () => Promise<string | null> | string | null

export type FetchFn = typeof fetch

export type BackendConfig = {
  storagePrefix: string
  databaseName: string
  databaseType: 'postgres' | 'mysql'
  fetchFn: FetchFn
}

const HISTORY_LIMIT = 100
const STREAM_ROW_LIMIT = 1000

type StreamEvent = {
  type: 'meta' | 'row' | 'complete' | 'error'
  columns?: QueryResponse['columns']
  row?: Record<string, unknown>
  error?: string
  row_count?: number
  truncated?: boolean
}

function withAuditParams(url: string, audit?: QueryAudit): string {
  if (!audit?.actor && !audit?.operation) {
    return url
  }
  // Handle relative URLs by using window.location.origin as base
  // new URL() requires absolute URL, so use window.location.origin as base for relative paths
  const requestUrl =
    url.startsWith('http://') || url.startsWith('https://')
      ? new URL(url)
      : new URL(url, window.location.origin)
  if (audit?.actor) {
    requestUrl.searchParams.set('actor', audit.actor)
  }
  if (audit?.operation) {
    requestUrl.searchParams.set('operation', audit.operation)
  }
  return requestUrl.toString()
}

function createStorageHelpers(storagePrefix: string) {
  const historyKey = `${storagePrefix}history`

  function getStorage() {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      return window.localStorage
    } catch {
      return null
    }
  }

  function getStoredJson<T>(key: string): T | null {
    const storage = getStorage()
    if (!storage) {
      return null
    }
    const raw = storage.getItem(key)
    if (!raw) {
      return null
    }
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  function setStoredJson(key: string, value: unknown) {
    const storage = getStorage()
    if (!storage) {
      return
    }
    try {
      storage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn('Failed to persist workbench state', error)
    }
  }

  function removeStoredItem(key: string) {
    getStorage()?.removeItem(key)
  }

  return {
    historyKey,
    getStoredJson,
    setStoredJson,
    removeStoredItem,
  }
}

async function runRemoteQuery(
  query: string,
  accountId: string,
  getToken: GetToken,
  keys: DecryptedKeys,
  fetchFn: FetchFn,
  audit?: QueryAudit,
): Promise<QueryResponse> {
  try {
    const queryServiceUrl = await getQueryServiceUrl()
    const token = await getToken()

    const url = withAuditParams(`${queryServiceUrl}/api/account/${accountId}/run`, audit)
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query,
        database_key: keys.databaseKey,
        account_key: keys.accountKey,
      }),
    })

    const data = (await response.json()) as QueryResponse

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Query service error: ${response.status}`,
      }
    }

    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown query error'
    return { success: false, error: message }
  }
}

function parseExportFilename(headerValue: string | null): string | null {
  if (!headerValue) return null
  const matches = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(headerValue)
  if (!matches?.[1]) return null
  try {
    return decodeURIComponent(matches[1])
  } catch {
    return matches[1]
  }
}

async function exportRemoteQuery(
  query: string,
  options: ExportRunOptions,
  accountId: string,
  getToken: GetToken,
  keys: DecryptedKeys,
  fetchFn: FetchFn,
  audit?: QueryAudit,
): Promise<ExportRunResult> {
  const queryServiceUrl = await getQueryServiceUrl()
  const token = await getToken()

  const url = withAuditParams(`${queryServiceUrl}/api/account/${accountId}/run`, audit)
  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      query,
      database_key: keys.databaseKey,
      account_key: keys.accountKey,
      format: options.format,
      columns: options.columns,
      csv_delimiter: options.csvDelimiter,
      sql_table: options.sqlTable,
    }),
  })

  if (!response.ok) {
    let detail = `Query service error: ${response.status}`
    try {
      const data = (await response.json()) as { detail?: string; error?: string }
      detail = data.error || data.detail || detail
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(detail)
  }

  const blob = await response.blob()
  const filename =
    parseExportFilename(response.headers.get('Content-Disposition')) ??
    `query.${options.format === 'json' ? 'ndjson' : options.format}`
  const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream'

  return { blob, filename, contentType }
}

function applyStreamHandlers(response: QueryResponse, handlers?: StreamQueryHandlers) {
  if (!handlers) {
    return
  }
  if (response.success) {
    handlers.onColumns?.(response.columns ?? [])
    if (Array.isArray(response.result)) {
      response.result.forEach((row) => handlers.onRow?.(row as Record<string, unknown>))
    }
    handlers.onComplete?.({
      rowCount: response.result?.length ?? 0,
      truncated: false,
    })
  } else {
    handlers.onError?.(response.error ?? 'Failed to run query')
  }
}

async function streamRemoteQuery(
  query: string,
  accountId: string,
  getToken: GetToken,
  keys: DecryptedKeys,
  fetchFn: FetchFn,
  handlers?: StreamQueryHandlers,
  audit?: QueryAudit,
): Promise<QueryResponse> {
  try {
    const queryServiceUrl = await getQueryServiceUrl()
    const token = await getToken()

    const url = withAuditParams(`${queryServiceUrl}/api/account/${accountId}/stream`, audit)
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        Accept: 'application/x-ndjson',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query,
        database_key: keys.databaseKey,
        account_key: keys.accountKey,
        max_rows: STREAM_ROW_LIMIT,
      }),
    })

    if (!response.ok) {
      let detail = `Query service error: ${response.status}`
      try {
        const data = (await response.json()) as { detail?: string; error?: string }
        detail = data.error || data.detail || detail
      } catch {
        // ignore JSON parse errors
      }
      const failure = { success: false, error: detail }
      applyStreamHandlers(failure, handlers)
      return failure
    }

    if (!response.body || typeof response.body.getReader !== 'function') {
      const fallback = await runRemoteQuery(query, accountId, getToken, keys, fetchFn, audit)
      applyStreamHandlers(fallback, handlers)
      return fallback
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const rows: Record<string, unknown>[] = []
    let columns: QueryResponse['columns'] | undefined
    let streamError: string | null = null
    let truncated = false
    let rowCount = 0
    let completeSeen = false

    const handleEvent = (event: StreamEvent) => {
      switch (event.type) {
        case 'meta':
          columns = event.columns ?? []
          handlers?.onColumns?.(columns)
          break
        case 'row':
          if (event.row) {
            rows.push(event.row)
            rowCount += 1
            handlers?.onRow?.(event.row)
          }
          break
        case 'complete':
          completeSeen = true
          if (typeof event.row_count === 'number') {
            rowCount = event.row_count
          }
          truncated = Boolean(event.truncated)
          handlers?.onComplete?.({ rowCount, truncated })
          break
        case 'error':
          streamError = event.error ?? 'Streaming query failed'
          handlers?.onError?.(streamError)
          break
        default:
          break
      }
    }

    readLoop: while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          continue
        }
        try {
          const event = JSON.parse(trimmed) as StreamEvent
          handleEvent(event)
          if (streamError) {
            await reader.cancel()
            break readLoop
          }
        } catch (err) {
          streamError = err instanceof Error ? err.message : 'Failed to parse stream'
          handlers?.onError?.(streamError)
          await reader.cancel()
          break readLoop
        }
      }
    }

    const tail = buffer.trim()
    if (tail && !streamError) {
      try {
        const event = JSON.parse(tail) as StreamEvent
        handleEvent(event)
      } catch (err) {
        streamError = err instanceof Error ? err.message : 'Failed to parse stream'
        handlers?.onError?.(streamError)
      }
    }

    if (!completeSeen && !streamError) {
      handlers?.onComplete?.({ rowCount, truncated })
    }

    if (streamError) {
      return {
        success: false,
        error: streamError,
        columns,
        result: rows,
      }
    }

    return {
      success: true,
      columns,
      result: rows,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown query error'
    const failure = { success: false, error: message }
    applyStreamHandlers(failure, handlers)
    return failure
  }
}

export function createBaseWorkbenchBackend(
  config: BackendConfig,
  accountId: string,
  client: Client<paths>,
  getToken: GetToken,
  passphrase?: string,
): WorkbenchBackend {
  const { storagePrefix, databaseName, databaseType, fetchFn } = config
  const databaseId = `account:${accountId}`
  const storage = createStorageHelpers(storagePrefix)
  storage.removeStoredItem(storage.historyKey)

  let cachedKeys: DecryptedKeys | null = null
  let memoryHistory: HistoryItem[] = []

  const fetchKeys = async (): Promise<DecryptedKeys> => {
    if (!passphrase) {
      throw new Error('Passphrase required for vault mode')
    }

    const { data, error } = await client.POST('/api/account/{account_id}/keys', {
      params: { path: { account_id: accountId } },
      body: { passphrase },
    })

    if (data) {
      return {
        databaseKey: data.database_key,
        accountKey: data.account_key,
      }
    }

    throw new Error(error ? String(error) : 'Failed to fetch keys')
  }

  const database: DatabaseInfo = {
    name: databaseName,
    type: databaseType,
    schema: 'public',
  }

  return {
    databaseId,
    database,
    query: {
      run: async (query: string, audit?: QueryAudit) => {
        if (!cachedKeys) {
          cachedKeys = await fetchKeys()
        }
        return runRemoteQuery(query, accountId, getToken, cachedKeys, fetchFn, audit)
      },
      streamQuery: async (query: string, handlers?: StreamQueryHandlers, audit?: QueryAudit) => {
        if (!cachedKeys) {
          cachedKeys = await fetchKeys()
        }
        return streamRemoteQuery(query, accountId, getToken, cachedKeys, fetchFn, handlers, audit)
      },
      exportQuery: async (query: string, options: ExportRunOptions, audit?: QueryAudit) => {
        if (!cachedKeys) {
          cachedKeys = await fetchKeys()
        }
        return exportRemoteQuery(query, options, accountId, getToken, cachedKeys, fetchFn, audit)
      },
    },
    history: {
      list: async () => [...memoryHistory],
      add: async (item: HistoryItem) => {
        memoryHistory = [item, ...memoryHistory].slice(0, HISTORY_LIMIT)
      },
      clear: async () => {
        memoryHistory = []
        storage.removeStoredItem(storage.historyKey)
      },
    },
  }
}
