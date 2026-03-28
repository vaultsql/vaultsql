import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseValue, TypedInput } from '@/workbench/components/editors'
import type { ColumnInfo } from '@/workbench/types/database'

type EditCellDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  column: ColumnInfo | null
  value: unknown
  pendingValue?: unknown
  onSave: (value: unknown, opts: { isNull?: boolean; useDefault?: boolean }) => void
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2) ?? ''
  } catch {
    return String(value)
  }
}

function formatEditValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object') return safeStringify(value)
  return String(value)
}

export function EditCellDialog({
  open,
  onOpenChange,
  column,
  value,
  pendingValue,
  onSave,
}: EditCellDialogProps) {
  const [editValue, setEditValue] = useState('')
  const [isNull, setIsNull] = useState(false)
  const [useDefault, setUseDefault] = useState(false)

  const initialValue = pendingValue !== undefined ? pendingValue : value
  const canBeNull = column?.nullable ?? false
  const hasDefault = column ? column.hasServerDefault || column.defaultValue !== null : false

  useEffect(() => {
    if (!open || !column) return
    const initialIsNull = initialValue === null || initialValue === undefined
    setEditValue(formatEditValue(initialValue))
    setIsNull(initialIsNull)
    setUseDefault(false)
  }, [open, column, initialValue])

  const handleNullToggle = () => {
    setIsNull((prev) => {
      const next = !prev
      if (next) setUseDefault(false)
      return next
    })
  }

  const handleDefaultToggle = () => {
    setUseDefault((prev) => {
      const next = !prev
      if (next) setIsNull(false)
      return next
    })
  }

  const handleSave = () => {
    if (!column) return
    if (useDefault) {
      onSave(null, { useDefault: true })
      onOpenChange(false)
      return
    }
    if (isNull) {
      onSave(null, { isNull: true })
      onOpenChange(false)
      return
    }
    onSave(parseValue(editValue, column), {})
    onOpenChange(false)
  }

  const description = useMemo(() => {
    if (!column) return 'Edit value'
    return `${column.dataType}${column.nullable ? ' • nullable' : ''}`
  }, [column])

  if (!column) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-medium">{`Edit ${column.name}`}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {canBeNull && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isNull} onChange={handleNullToggle} />
                NULL
              </label>
            )}
            {hasDefault && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={useDefault} onChange={handleDefaultToggle} />
                Use default
              </label>
            )}
          </div>

          {column.category === 'boolean' ? (
            <TypedInput
              category="boolean"
              value={editValue}
              onChange={setEditValue}
              onKeyDown={() => {}}
              compact={false}
            />
          ) : (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              disabled={isNull || useDefault}
              rows={8}
              className="w-full min-h-[220px] rounded-md border border-border bg-background px-3 py-2 text-xs font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
              placeholder="Enter value"
            />
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
