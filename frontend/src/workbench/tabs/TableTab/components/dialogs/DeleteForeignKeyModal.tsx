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
import type { ForeignKeyInfo } from '@/workbench/types/database'
import { useTableStructureStore } from '../../state/useTableStructureStore'

type DeleteForeignKeyModalProps = {
  open: boolean
  onClose: () => void
  schema: string
  table: string
  foreignKey: ForeignKeyInfo
  onSuccess?: () => void
}

export function DeleteForeignKeyModal({
  open,
  onClose,
  schema,
  table,
  foreignKey,
  onSuccess,
}: DeleteForeignKeyModalProps) {
  const { db } = useWorkbench()
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    try {
      const result = db.buildDropForeignKeyQuery({
        schema,
        table,
        constraintName: foreignKey.constraintName,
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table, foreignKey.constraintName])

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
        operation: 'drop_foreign_key',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to drop foreign key')
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
      <DialogTitle>Delete foreign key</DialogTitle>
      <DialogDescription>
        This will permanently remove the foreign key constraint from the table.
      </DialogDescription>
      <DialogBody className="space-y-4">
        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
          You are about to delete foreign key{' '}
          <strong className="font-mono">{foreignKey.constraintName}</strong> which references{' '}
          <strong className="font-mono">
            {foreignKey.refSchema}.{foreignKey.refTable}.{foreignKey.refColumn}
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
          {isSubmitting ? 'Deleting...' : 'Delete foreign key'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
