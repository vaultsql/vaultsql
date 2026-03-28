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

type ColumnModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: string
  table: string
  mode: 'add' | 'edit'
  column?: ColumnInfo // existing column for edit mode
  onSuccess?: () => void
}

type FormState = {
  name: string
  dataType: string
  notNull: boolean
  defaultValue: string
  comment: string
}

function getInitialState(mode: 'add' | 'edit', column?: ColumnInfo): FormState {
  if (mode === 'edit' && column) {
    return {
      name: column.name,
      dataType: column.dataType,
      notNull: !column.nullable,
      defaultValue: column.defaultValue ?? '',
      comment: column.comment ?? '',
    }
  }
  return {
    name: 'new_column',
    dataType: 'integer',
    notNull: false,
    defaultValue: '',
    comment: '',
  }
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function ColumnModal({
  open,
  onOpenChange,
  schema,
  table,
  mode,
  column,
  onSuccess,
}: ColumnModalProps) {
  const { db } = useWorkbench()
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)
  const invalidateColumns = useColumnsStore((state) => state.invalidateTable)

  const [form, setForm] = useState<FormState>(() => getInitialState(mode, column))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens or mode/column changes
  useEffect(() => {
    if (open) {
      setForm(getInitialState(mode, column))
      setError(null)
    }
  }, [open, mode, column])

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    if (!form.name.trim() || !form.dataType.trim()) {
      return null
    }

    try {
      const statements: string[] = []

      if (mode === 'add') {
        const result = db.buildAddColumnQuery({
          schema,
          table,
          column: {
            name: form.name.trim(),
            dataType: form.dataType.trim(),
            nullable: !form.notNull,
            defaultValue: form.defaultValue.trim() || undefined,
          },
        })
        statements.push(result.sql)

        // Add comment if provided
        if (form.comment.trim()) {
          const commentSql = `COMMENT ON COLUMN ${quoteIdentifier(schema)}.${quoteIdentifier(table)}.${quoteIdentifier(form.name.trim())} IS ${quoteString(form.comment.trim())}`
          statements.push(commentSql)
        }

        return statements.join(';\n')
      }

      // Edit mode - build ALTER COLUMN query
      if (!column) return null

      // Determine what has changed
      const changes: {
        dataType?: string
        nullable?: boolean
        defaultValue?: string | null
      } = {}

      if (form.dataType.trim() !== column.dataType) {
        changes.dataType = form.dataType.trim()
      }

      if (form.notNull !== !column.nullable) {
        changes.nullable = !form.notNull
      }

      const newDefault = form.defaultValue.trim() || null
      const oldDefault = column.defaultValue ?? null
      if (newDefault !== oldDefault) {
        changes.defaultValue = newDefault
      }

      // Build ALTER COLUMN if there are changes
      if (Object.keys(changes).length > 0) {
        const result = db.buildAlterColumnQuery({
          schema,
          table,
          column: column.name,
          ...changes,
        })
        statements.push(result.sql)
      }

      // Check if comment changed
      const newComment = form.comment.trim()
      const oldComment = column.comment ?? ''
      if (newComment !== oldComment) {
        if (newComment) {
          const commentSql = `COMMENT ON COLUMN ${quoteIdentifier(schema)}.${quoteIdentifier(table)}.${quoteIdentifier(column.name)} IS ${quoteString(newComment)}`
          statements.push(commentSql)
        } else {
          // Remove comment
          const commentSql = `COMMENT ON COLUMN ${quoteIdentifier(schema)}.${quoteIdentifier(table)}.${quoteIdentifier(column.name)} IS NULL`
          statements.push(commentSql)
        }
      }

      // If nothing changed, return placeholder
      if (statements.length === 0) {
        return '-- No changes'
      }

      return statements.join(';\n')
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table, mode, column, form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim() || !form.dataType.trim()) {
      setError('Name and Data Type are required')
      return
    }

    if (!sqlPreview || sqlPreview.startsWith('--')) {
      // Nothing to execute
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Execute each statement separately (for multi-statement like ALTER + COMMENT)
      const statements = sqlPreview.split(';\n').filter((s) => s.trim())

      for (const statement of statements) {
        const response = await db.query(statement, {
          actor: 'table',
          operation: mode === 'add' ? 'add_column' : 'alter_column',
        })

        if (!response.success) {
          setError(response.error ?? 'Failed to execute query')
          setIsSubmitting(false)
          return
        }
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
    setForm((prev) => ({ ...prev, name: e.target.value }))
  }

  const handleDataTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, dataType: e.target.value }))
  }

  const handleNotNullChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, notNull: e.target.checked }))
  }

  const handleDefaultChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, defaultValue: e.target.value }))
  }

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, comment: e.target.value }))
  }

  const title = mode === 'add' ? 'Add Column' : 'Edit Column'
  const isNameDisabled = mode === 'edit' // Can't rename via this modal

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === 'add' ? 'Add a new column to the table' : 'Edit column properties'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Name field */}
            <div className="space-y-1.5">
              <label htmlFor="column-name" className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <input
                id="column-name"
                type="text"
                value={form.name}
                onChange={handleNameChange}
                disabled={isNameDisabled}
                placeholder="column_name"
                autoFocus={mode === 'add'}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Data Type field */}
            <div className="space-y-1.5">
              <label
                htmlFor="column-data-type"
                className="text-xs font-medium text-muted-foreground"
              >
                Data Type
              </label>
              <input
                id="column-data-type"
                type="text"
                value={form.dataType}
                onChange={handleDataTypeChange}
                placeholder="e.g. integer, text, jsonb, varchar(255)"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Not Null checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="column-not-null"
                type="checkbox"
                checked={form.notNull}
                onChange={handleNotNullChange}
                className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
              />
              <label htmlFor="column-not-null" className="text-sm cursor-pointer">
                Not Null
              </label>
            </div>

            {/* Default Expression field */}
            <div className="space-y-1.5">
              <label htmlFor="column-default" className="text-xs font-medium text-muted-foreground">
                Default Expression
              </label>
              <input
                id="column-default"
                type="text"
                value={form.defaultValue}
                onChange={handleDefaultChange}
                placeholder="e.g. 0, 'default', NOW()"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Comment field */}
            <div className="space-y-1.5">
              <label htmlFor="column-comment" className="text-xs font-medium text-muted-foreground">
                Comment
              </label>
              <input
                id="column-comment"
                type="text"
                value={form.comment}
                onChange={handleCommentChange}
                placeholder="Column description"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
              {sqlPreview ?? '-- Enter column details'}
            </pre>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0">
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" color="indigo" disabled={isSubmitting || !sqlPreview}>
              {isSubmitting ? 'Applying...' : 'OK'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
