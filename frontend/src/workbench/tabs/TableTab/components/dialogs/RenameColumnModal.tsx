import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import { useColumnsStore } from '@/workbench/features/schema-browser/useColumnsStore'
import type { ColumnInfo } from '@/workbench/types/database'
import { useTableStructureStore } from '../../state/useTableStructureStore'

type RenameColumnModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: string
  table: string
  column: ColumnInfo
  onSuccess?: () => void
}

export function RenameColumnModal({
  open,
  onOpenChange,
  schema,
  table,
  column,
  onSuccess,
}: RenameColumnModalProps) {
  const { db } = useWorkbench()
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)
  const invalidateColumns = useColumnsStore((state) => state.invalidateTable)

  const [newName, setNewName] = useState(column.name)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens or column changes
  useEffect(() => {
    if (open) {
      setNewName(column.name)
      setError(null)
    }
  }, [open, column])

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    const trimmedName = newName.trim()
    if (!trimmedName) {
      return '-- Enter a new column name'
    }

    if (trimmedName === column.name) {
      return '-- No changes'
    }

    try {
      const result = db.buildRenameColumnQuery({
        schema,
        table,
        column: column.name,
        newName: trimmedName,
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table, column.name, newName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = newName.trim()
    if (!trimmedName) {
      setError('Column name is required')
      return
    }

    if (trimmedName === column.name) {
      // Nothing to do
      onOpenChange(false)
      return
    }

    if (!sqlPreview || sqlPreview.startsWith('--')) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await db.query(sqlPreview, {
        actor: 'table',
        operation: 'rename_column',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to rename column')
        setIsSubmitting(false)
        return
      }

      // Invalidate caches to trigger reload
      invalidateStructure(schema, table)
      invalidateColumns(schema, table)

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value)
  }

  const hasChanges = newName.trim() !== column.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-medium">Rename Column</DialogTitle>
          <DialogDescription className="sr-only">Rename the column {column.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Current name (read-only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Current Name</label>
              <div className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-mono text-muted-foreground">
                {column.name}
              </div>
            </div>

            {/* New name field */}
            <div className="space-y-1.5">
              <label
                htmlFor="new-column-name"
                className="text-xs font-medium text-muted-foreground"
              >
                New Name
              </label>
              <input
                id="new-column-name"
                type="text"
                value={newName}
                onChange={handleNameChange}
                placeholder="new_column_name"
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-950/30 border border-red-900/50 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 break-all">{error}</p>
              </div>
            )}
          </div>

          {/* SQL Preview */}
          <div className="border-t border-border px-5 py-3 bg-muted/30">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Preview
            </div>
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all bg-background/50 rounded-md p-2 border border-border/50 max-h-24 overflow-y-auto">
              {sqlPreview}
            </pre>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0">
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" color="indigo" disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
