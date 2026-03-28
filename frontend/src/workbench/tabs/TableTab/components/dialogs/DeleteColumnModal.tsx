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
import { useColumnsStore } from '@/workbench/features/schema-browser/useColumnsStore'
import type { ColumnInfo } from '@/workbench/types/database'
import { useTableStructureStore } from '../../state/useTableStructureStore'

type DeleteColumnModalProps = {
  open: boolean
  onClose: () => void
  schema: string
  table: string
  column: ColumnInfo
  onSuccess?: () => void
}

export function DeleteColumnModal({
  open,
  onClose,
  schema,
  table,
  column,
  onSuccess,
}: DeleteColumnModalProps) {
  const { db } = useWorkbench()
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)
  const invalidateColumns = useColumnsStore((state) => state.invalidateTable)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    try {
      const result = db.buildDropColumnQuery({
        schema,
        table,
        column: column.name,
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table, column.name])

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
        operation: 'drop_column',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to drop column')
        setIsSubmitting(false)
        return
      }

      // Invalidate caches to trigger reload
      invalidateStructure(schema, table)
      invalidateColumns(schema, table)

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
      <DialogTitle>Delete column</DialogTitle>
      <DialogDescription>
        This will permanently remove the column and all its data from the table.
      </DialogDescription>
      <DialogBody className="space-y-4">
        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
          You are about to delete column <strong className="font-mono">{column.name}</strong> from{' '}
          <strong className="font-mono">
            {schema}.{table}
          </strong>
          .
        </Text>

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
          {isSubmitting ? 'Deleting...' : 'Delete column'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
