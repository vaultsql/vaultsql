import { Check, Copy, Pencil } from 'lucide-react'
import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { RichCellEditor } from '@/workbench/components/editors'
import type { ColumnInfo } from '@/workbench/types/database'
import { formatValue } from './details/formatters'

type EditableCellProps = {
  column: ColumnInfo
  value: unknown
  pendingValue?: unknown
  onEdit: (
    column: string,
    value: unknown,
    opts?: { isNull?: boolean; useDefault?: boolean },
  ) => void
}

/**
 * A cell that displays a value with copy/edit actions on hover.
 * When in edit mode, shows the RichCellEditor with dropdown menu.
 * Highlights orange when there's a pending edit.
 */
export function EditableCell({ column, value, pendingValue, onEdit }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasPendingEdit = pendingValue !== undefined
  const displayValue = hasPendingEdit ? pendingValue : value
  const formatted = formatValue(displayValue, column.category)

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleSave = (newValue: unknown, opts: { isNull?: boolean; useDefault?: boolean }) => {
    onEdit(column.name, newValue, opts)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted.copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSetNull = () => {
    onEdit(column.name, null, { isNull: true })
  }

  const handleSetDefault = () => {
    onEdit(column.name, null, { useDefault: true })
  }

  const isNullish = displayValue === null || displayValue === undefined
  const hasDefault = column.hasServerDefault || column.defaultValue !== null

  if (isEditing) {
    return (
      <RichCellEditor
        column={column}
        value={value}
        pendingValue={pendingValue}
        onSave={handleSave}
        onCancel={handleCancel}
        autoFocus={true}
        compact={false}
      />
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`group flex items-start gap-1.5 rounded px-1 -mx-1 ${
            hasPendingEdit ? 'bg-amber-500/20 ring-1 ring-amber-500/30' : ''
          }`}
        >
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
            title="Copy value"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {/* Value */}
          <span className={`flex-1 break-all ${formatted.isNull ? 'text-muted-foreground' : ''}`}>
            {formatted.display}
          </span>

          {/* Edit button */}
          <button
            type="button"
            onClick={handleStartEdit}
            className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
            title="Edit value"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleCopy}>Copy cell value</ContextMenuItem>
        {column.nullable && (
          <ContextMenuItem onSelect={handleSetNull} disabled={isNullish}>
            Set NULL
          </ContextMenuItem>
        )}
        {hasDefault && <ContextMenuItem onSelect={handleSetDefault}>Set default</ContextMenuItem>}
        <ContextMenuItem onSelect={handleStartEdit}>Edit {column.name}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
