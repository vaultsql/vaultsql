import { useCallback, useState } from 'react'
import type { components } from '@/lib/openapi'
import { useWorkbench } from '../../context/useWorkbench'

type QueryResponse = components['schemas']['QueryResponse']

export type WorksheetStatus = 'idle' | 'loading' | 'success' | 'error'

export function useWorksheetData() {
  const { db } = useWorkbench()
  const [status, setStatus] = useState<WorksheetStatus>('idle')
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const executeQuery = useCallback(
    async (sql: string) => {
      if (!sql.trim()) {
        return
      }

      setStatus('loading')
      setError(null)

      try {
        const response = await db.query(sql, {
          actor: 'custom',
          operation: 'worksheet_query',
        })

        if (response.success) {
          setStatus('success')
          setResult(response)
        } else {
          setStatus('error')
          setResult(response)
          setError(response.error ?? 'Failed to run query')
        }
      } catch (err) {
        setStatus('error')
        setResult(null)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    [db],
  )

  return {
    status,
    result,
    error,
    isLoading: status === 'loading',
    executeQuery,
  }
}
