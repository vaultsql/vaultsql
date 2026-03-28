import { FileCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWorkbench } from '@/workbench/context/useWorkbench'

type ViewDefinitionPaneProps = {
  schema: string
  view: string
}

type LoadState = 'idle' | 'loading' | 'success' | 'error'

export function ViewDefinitionPane({ schema, view }: ViewDefinitionPaneProps) {
  const { db } = useWorkbench()
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [definition, setDefinition] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDefinition() {
      setLoadState('loading')
      setError(null)

      try {
        const def = await db.getViewDefinition(schema, view)
        if (!cancelled) {
          setDefinition(def)
          setLoadState('success')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load view definition')
          setLoadState('error')
        }
      }
    }

    void loadDefinition()

    return () => {
      cancelled = true
    }
  }, [db, schema, view])

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading view definition…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="text-sm text-rose-600">Failed to load view definition</p>
          <p className="mt-1 text-xs text-rose-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileCode className="h-4 w-4" />
            View Definition
          </h3>
        </div>
        <div className="overflow-hidden rounded-md border border-border bg-muted/30">
          <pre className="overflow-auto p-4 font-mono text-xs text-foreground">
            <code>{definition}</code>
          </pre>
        </div>
      </section>
    </div>
  )
}
