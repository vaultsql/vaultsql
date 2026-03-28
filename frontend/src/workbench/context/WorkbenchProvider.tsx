import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  HistoryItem,
  QueryAudit,
  QueryResponse,
  StreamQueryHandlers,
  WorkbenchBackend,
} from '@/workbench/types/database'
import { createStarredStore, type StarredStoreApi } from '../features/starred'
import { DatabaseService } from '../lib/DatabaseService'
import { WorkbenchContext, type WorkbenchContextValue } from './context'
import { type AccessLevel, type DatabaseEnvironment, derivePermissions } from './permissions'

export type WorkbenchProviderProps = PropsWithChildren<{
  backend: WorkbenchBackend
  accountId: string
  accountName: string
  databaseId: string
  databaseName: string
  databaseType: string
  accessLevel?: AccessLevel
  environment?: DatabaseEnvironment
}>

const DEFAULT_AUDIT = {
  actor: 'application',
  operation: 'query',
} as const

function normalizeAudit(audit?: QueryAudit) {
  return {
    actor: audit?.actor ?? DEFAULT_AUDIT.actor,
    operation: audit?.operation ?? DEFAULT_AUDIT.operation,
  }
}

function normalizeHistoryItem(item: HistoryItem): HistoryItem {
  return {
    ...item,
    actor: item.actor ?? DEFAULT_AUDIT.actor,
    operation: item.operation ?? DEFAULT_AUDIT.operation,
  }
}

export function WorkbenchProvider({
  children,
  backend,
  accountId,
  accountName,
  databaseId,
  databaseName,
  databaseType,
  accessLevel = 'readonly',
  environment = null,
}: WorkbenchProviderProps) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Create starred store scoped to this account
  const starredStoreRef = useRef<StarredStoreApi | null>(null)
  if (!starredStoreRef.current) {
    starredStoreRef.current = createStarredStore(accountId)
  }
  const starredStore = starredStoreRef.current

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const historyData = await backend.history.list()

        if (mounted) {
          setHistory(historyData.map(normalizeHistoryItem))
          setIsInitialized(true)
        }
      } catch (err) {
        console.error('Failed to initialize workbench backend', err)
        if (mounted) {
          setIsInitialized(true)
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [backend])

  const runQuery = useCallback(
    async (query: string, audit?: QueryAudit): Promise<QueryResponse> => {
      const start = performance.now()
      const resolvedAudit = normalizeAudit(audit)
      let error: string | undefined
      let rowCount: number | undefined
      let result: QueryResponse

      try {
        result = await backend.query.run(query, resolvedAudit)
        rowCount = result.result?.length
        error = result.error || undefined
      } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error executing query'
        result = { success: false, error }
      }

      const end = performance.now()
      const historyItem: HistoryItem = {
        id: crypto.randomUUID(),
        query,
        timestamp: Date.now(),
        durationMs: end - start,
        rowCount,
        actor: resolvedAudit.actor,
        operation: resolvedAudit.operation,
        error,
      }

      await backend.history.add(historyItem)
      setHistory((prev) => [historyItem, ...prev])

      return result
    },
    [backend],
  )

  const streamQuery = useCallback(
    async (
      query: string,
      handlers?: StreamQueryHandlers,
      audit?: QueryAudit,
    ): Promise<QueryResponse> => {
      const start = performance.now()
      const resolvedAudit = normalizeAudit(audit)
      let error: string | undefined
      let rowCount: number | undefined
      let result: QueryResponse

      try {
        result = await backend.query.streamQuery(query, handlers, resolvedAudit)
        rowCount = result.result?.length
        error = result.error || undefined
      } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error executing query'
        result = { success: false, error }
      }

      const end = performance.now()
      const historyItem: HistoryItem = {
        id: crypto.randomUUID(),
        query,
        timestamp: Date.now(),
        durationMs: end - start,
        rowCount,
        actor: resolvedAudit.actor,
        operation: resolvedAudit.operation,
        error,
      }

      await backend.history.add(historyItem)
      setHistory((prev) => [historyItem, ...prev])

      return result
    },
    [backend],
  )

  const clearHistory = useCallback(async () => {
    await backend.history.clear()
    setHistory([])
  }, [backend])

  const db = useMemo(
    () => new DatabaseService(runQuery, backend.database, streamQuery),
    [runQuery, streamQuery, backend.database],
  )

  const permissions = useMemo(
    () => derivePermissions(accessLevel, environment),
    [accessLevel, environment],
  )

  const mode = useMemo(() => {
    // Derive mode from accessLevel for backwards compatibility
    return accessLevel === 'readonly' ? 'READ_ONLY' : 'READ_WRITE'
  }, [accessLevel])

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      db,
      databaseId: backend.databaseId,
      accountId,
      accountName,
      databaseName,
      databaseType,
      mode,
      permissions,
      history,
      clearHistory,
      backend,
      starredStore,
    }),
    [
      db,
      backend,
      clearHistory,
      history,
      accountId,
      accountName,
      starredStore,
      databaseId,
      databaseName,
      databaseType,
      mode,
      permissions,
    ],
  )

  if (!isInitialized) {
    return null
  }

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}
