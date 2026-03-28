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
import type { ColumnInfo, ForeignKeyAction, WorkbenchAsset } from '@/workbench/types/database'
import { useTableStructureStore } from '../../state/useTableStructureStore'

type ForeignKeyModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: string
  table: string
  columns: ColumnInfo[]
  onSuccess?: () => void
}

type FormState = {
  column: string
  refSchema: string
  refTable: string
  refColumn: string
  onDelete: ForeignKeyAction
  onUpdate: ForeignKeyAction
}

const FK_ACTIONS: ForeignKeyAction[] = ['NO ACTION', 'CASCADE', 'SET NULL', 'RESTRICT']

function getInitialState(): FormState {
  return {
    column: '',
    refSchema: '',
    refTable: '',
    refColumn: '',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  }
}

export function ForeignKeyModal({
  open,
  onOpenChange,
  schema,
  table,
  columns,
  onSuccess,
}: ForeignKeyModalProps) {
  const { db } = useWorkbench()
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)

  const [form, setForm] = useState<FormState>(getInitialState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Schema/table/column loading for reference selection
  const [schemas, setSchemas] = useState<string[]>([])
  const [tables, setTables] = useState<WorkbenchAsset[]>([])
  const [refColumns, setRefColumns] = useState<ColumnInfo[]>([])
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false)
  const [isLoadingTables, setIsLoadingTables] = useState(false)
  const [isLoadingColumns, setIsLoadingColumns] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({ ...getInitialState(), refSchema: schema })
      setError(null)
    }
  }, [open, schema])

  // Load schemas on open
  useEffect(() => {
    if (!open) return

    setIsLoadingSchemas(true)
    db.loadSchemaNames()
      .then(setSchemas)
      .catch(() => setSchemas([]))
      .finally(() => setIsLoadingSchemas(false))
  }, [open, db])

  // Load tables when schema changes
  useEffect(() => {
    if (!form.refSchema) {
      setTables([])
      return
    }

    setIsLoadingTables(true)
    db.loadSchemaAssets(form.refSchema)
      .then((assets) => setTables(assets.filter((a) => a.type === 'table')))
      .catch(() => setTables([]))
      .finally(() => setIsLoadingTables(false))
  }, [form.refSchema, db])

  // Load columns when table changes
  useEffect(() => {
    if (!form.refSchema || !form.refTable) {
      setRefColumns([])
      return
    }

    setIsLoadingColumns(true)
    db.describeTable(form.refSchema, form.refTable)
      .then((structure) => setRefColumns(structure.columns))
      .catch(() => setRefColumns([]))
      .finally(() => setIsLoadingColumns(false))
  }, [form.refSchema, form.refTable, db])

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    if (!form.column || !form.refSchema || !form.refTable || !form.refColumn) {
      return null
    }

    try {
      const result = db.buildAddForeignKeyQuery({
        schema,
        table,
        column: form.column,
        refSchema: form.refSchema,
        refTable: form.refTable,
        refColumn: form.refColumn,
        onDelete: form.onDelete,
        onUpdate: form.onUpdate,
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table, form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.column || !form.refSchema || !form.refTable || !form.refColumn) {
      setError('All fields are required')
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
        operation: 'add_foreign_key',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to add foreign key')
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

  const isValid = form.column && form.refSchema && form.refTable && form.refColumn

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-medium">Add Foreign Key</DialogTitle>
          <DialogDescription className="sr-only">
            Add a new foreign key constraint to the table
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Column selection */}
            <div className="space-y-1.5">
              <label htmlFor="fk-column" className="text-xs font-medium text-muted-foreground">
                Column
              </label>
              <select
                id="fk-column"
                value={form.column}
                onChange={(e) => setForm((prev) => ({ ...prev, column: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select column...</option>
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dataType})
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Schema */}
            <div className="space-y-1.5">
              <label htmlFor="fk-ref-schema" className="text-xs font-medium text-muted-foreground">
                References Schema
              </label>
              <select
                id="fk-ref-schema"
                value={form.refSchema}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    refSchema: e.target.value,
                    refTable: '',
                    refColumn: '',
                  }))
                }
                disabled={isLoadingSchemas}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">Select schema...</option>
                {schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Table */}
            <div className="space-y-1.5">
              <label htmlFor="fk-ref-table" className="text-xs font-medium text-muted-foreground">
                References Table
              </label>
              <select
                id="fk-ref-table"
                value={form.refTable}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, refTable: e.target.value, refColumn: '' }))
                }
                disabled={isLoadingTables || !form.refSchema}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">Select table...</option>
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Column */}
            <div className="space-y-1.5">
              <label htmlFor="fk-ref-column" className="text-xs font-medium text-muted-foreground">
                References Column
              </label>
              <select
                id="fk-ref-column"
                value={form.refColumn}
                onChange={(e) => setForm((prev) => ({ ...prev, refColumn: e.target.value }))}
                disabled={isLoadingColumns || !form.refTable}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="">Select column...</option>
                {refColumns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.dataType})
                  </option>
                ))}
              </select>
            </div>

            {/* ON DELETE action */}
            <div className="space-y-1.5">
              <label htmlFor="fk-on-delete" className="text-xs font-medium text-muted-foreground">
                On Delete
              </label>
              <select
                id="fk-on-delete"
                value={form.onDelete}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, onDelete: e.target.value as ForeignKeyAction }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {FK_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            {/* ON UPDATE action */}
            <div className="space-y-1.5">
              <label htmlFor="fk-on-update" className="text-xs font-medium text-muted-foreground">
                On Update
              </label>
              <select
                id="fk-on-update"
                value={form.onUpdate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, onUpdate: e.target.value as ForeignKeyAction }))
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {FK_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
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
              {sqlPreview ?? '-- Select column and reference'}
            </pre>
          </div>

          <DialogFooter className="px-5 py-3 border-t border-border shrink-0">
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" color="indigo" disabled={isSubmitting || !isValid}>
              {isSubmitting ? 'Creating...' : 'Add Foreign Key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
