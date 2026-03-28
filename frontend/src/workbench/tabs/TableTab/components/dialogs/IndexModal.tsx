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
import type { ColumnInfo } from '@/workbench/types/database'
import { useTableStructureStore } from '../../state/useTableStructureStore'

type IndexModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: string
  table: string
  columns: ColumnInfo[]
  onSuccess?: () => void
}

type FormState = {
  name: string
  selectedColumns: string[]
  unique: boolean
}

function getInitialState(): FormState {
  return {
    name: '',
    selectedColumns: [],
    unique: false,
  }
}

export function IndexModal({
  open,
  onOpenChange,
  schema,
  table,
  columns,
  onSuccess,
}: IndexModalProps) {
  const { db } = useWorkbench()
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)

  const [form, setForm] = useState<FormState>(getInitialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm(getInitialState())
      setError(null)
    }
  }, [open])

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    if (form.selectedColumns.length === 0) {
      return null
    }

    try {
      const result = db.buildCreateIndexQuery({
        schema,
        table,
        index: {
          name: form.name.trim() || undefined,
          columns: form.selectedColumns,
          unique: form.unique,
        },
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table, form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (form.selectedColumns.length === 0) {
      setError('At least one column is required')
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
        operation: 'create_index',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to create index')
        setIsSubmitting(false)
        return
      }

      invalidateStructure(schema, table)
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, name: e.target.value }))
  }

  const handleUniqueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, unique: e.target.checked }))
  }

  const toggleColumn = (columnName: string) => {
    setForm((prev) => {
      const isSelected = prev.selectedColumns.includes(columnName)
      if (isSelected) {
        return { ...prev, selectedColumns: prev.selectedColumns.filter((c) => c !== columnName) }
      } else {
        return { ...prev, selectedColumns: [...prev.selectedColumns, columnName] }
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-medium">Add Index</DialogTitle>
          <DialogDescription className="sr-only">Add a new index to the table</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Name field (optional) */}
            <div className="space-y-1.5">
              <label htmlFor="index-name" className="text-xs font-medium text-muted-foreground">
                Name{' '}
                <span className="text-muted-foreground/60">
                  (optional, auto-generated if empty)
                </span>
              </label>
              <input
                id="index-name"
                type="text"
                value={form.name}
                onChange={handleNameChange}
                placeholder="idx_table_column"
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Column selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Columns</label>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background">
                {columns.map((col) => (
                  <label
                    key={col.name}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b border-border last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedColumns.includes(col.name)}
                      onChange={() => toggleColumn(col.name)}
                      className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                    />
                    <span className="font-mono text-sm">{col.name}</span>
                    <span className="text-xs text-muted-foreground">{col.dataType}</span>
                  </label>
                ))}
              </div>
              {form.selectedColumns.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Selected: {form.selectedColumns.join(', ')}
                </p>
              )}
            </div>

            {/* Unique checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="index-unique"
                type="checkbox"
                checked={form.unique}
                onChange={handleUniqueChange}
                className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
              />
              <label htmlFor="index-unique" className="text-sm cursor-pointer">
                Unique
              </label>
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
              {sqlPreview ?? '-- Select columns to index'}
            </pre>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0">
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="indigo"
              disabled={isSubmitting || form.selectedColumns.length === 0}
            >
              {isSubmitting ? 'Creating...' : 'Create Index'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
