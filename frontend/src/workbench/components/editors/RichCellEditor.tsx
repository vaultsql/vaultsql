import { useCallback, useEffect, useRef, useState } from 'react'
import type { ColumnInfo } from '@/workbench/types/database'
import { parseValue } from './parseValue'
import { TypedInput } from './TypedInput'

type RichCellEditorProps = {
  column: ColumnInfo
  value: unknown
  pendingValue?: unknown
  onSave: (value: unknown, opts: { isNull?: boolean; useDefault?: boolean }) => void
  onCancel: () => void
  autoFocus?: boolean
  compact?: boolean
}

/**
 * Rich cell editor with type-aware input and dropdown menu for Set NULL/Default/Cancel.
 * Shared between inline grid editing and details pane editing.
 */
export function RichCellEditor({
  column,
  value,
  pendingValue,
  onSave,
  onCancel,
  autoFocus = true,
  compact = false,
}: RichCellEditorProps) {
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const originalValue = pendingValue !== undefined ? pendingValue : value

  // Initialize edit value from pending or original
  useEffect(() => {
    const startValue = originalValue === null ? '' : String(originalValue)
    setEditValue(startValue)
  }, [originalValue])

  // Focus input when mounted
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [autoFocus])

  // Check if the value has changed from the original
  const hasValueChanged = useCallback(() => {
    const parsedValue = parseValue(editValue, column)
    // Compare with original value (before any pending edits)
    // Use JSON.stringify for deep comparison of objects
    const originalStr = originalValue === null ? null : JSON.stringify(originalValue)
    const newStr = parsedValue === null ? null : JSON.stringify(parsedValue)
    return originalStr !== newStr
  }, [editValue, column, originalValue])

  const handleSave = useCallback(() => {
    if (hasValueChanged()) {
      const parsedValue = parseValue(editValue, column)
      onSave(parsedValue, {})
    } else {
      onCancel()
    }
  }, [hasValueChanged, editValue, column, onSave, onCancel])

  // Click outside to save (equivalent to pressing Enter)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSave()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [handleSave])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation to prevent grid keyboard navigation from intercepting
    e.stopPropagation()

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full items-stretch"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <TypedInput
        ref={inputRef}
        category={column.category}
        value={editValue}
        onChange={setEditValue}
        onKeyDown={handleKeyDown}
        compact={compact}
      />
    </div>
  )
}
