import { AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Text } from '@/components/catalyst/text'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import type { IndexInfo } from '@/workbench/types/database'
import { useTableStructureStore } from '../../state/useTableStructureStore'

type DeleteIndexModalProps = {
  open: boolean
  onClose: () => void
  schema: string
  table: string
  index: IndexInfo
  onSuccess?: () => void
}

export function DeleteIndexModal({
  open,
  onClose,
  schema,
  table,
  index,
  onSuccess,
}: DeleteIndexModalProps) {
  const { db } = useWorkbench()
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    try {
      const result = db.buildDropIndexQuery({
        schema,
        table,
        indexName: index.name,
        ifExists: true,
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table, index.name])

  const handleConfirm = async () => {
    if (!sqlPreview || sqlPreview.startsWith('--')) {
      onClose()
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await db.query(sqlPreview, {
        actor: 'table',
        operation: 'drop_index',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to drop index')
        setIsSubmitting(false)
        return
      }

      invalidateStructure(schema, table)
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogTitle>Delete index</DialogTitle>
      <DialogDescription>This will permanently remove the index from the table.</DialogDescription>
      <DialogBody className="space-y-4">
        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
          You are about to delete index <strong className="font-mono">{index.name}</strong>
          {index.columns.length > 0 && (
            <>
              {' '}
              on columns <strong className="font-mono">{index.columns.join(', ')}</strong>
            </>
          )}
          .
        </Text>

        {index.isUnique && (
          <div className="flex items-start gap-2 rounded-md bg-amber-950/30 border border-amber-900/50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              This is a unique index. Dropping it will remove the uniqueness constraint.
            </p>
          </div>
        )}

        {/* SQL Preview */}
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            SQL to Execute
          </div>
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
            {sqlPreview}
          </pre>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-950/30 border border-red-900/50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400 break-all">{error}</p>
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button color="red" onClick={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Deleting...' : 'Delete index'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
