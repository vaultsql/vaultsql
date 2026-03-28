import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ColumnCategory, ColumnInfo, ColumnValue } from '@/workbench/types/database'

type AddRowDialogProps = {
  open: boolean
  onClose: (open: boolean) => void
  columns: ColumnInfo[]
  onSubmit: (values: Record<string, unknown>) => void
}

export function AddRowDialog({ open, onClose, columns, onSubmit }: AddRowDialogProps) {
  const [values, setValues] = useState<Record<string, ColumnValue>>({})

  // Filter out auto-increment columns - they're handled by the database
  const visibleColumns = useMemo(() => columns.filter((col) => !col.isAutoIncrement), [columns])

  // Group columns: required first, then optional
  const requiredColumns = useMemo(
    () => visibleColumns.filter((col) => !col.nullable && !col.hasServerDefault),
    [visibleColumns],
  )
  const optionalColumns = useMemo(
    () => visibleColumns.filter((col) => col.nullable || col.hasServerDefault),
    [visibleColumns],
  )

  // Initialize form values when dialog opens
  useEffect(() => {
    if (!open) return

    startTransition(() => {
      const initial: Record<string, ColumnValue> = {}
      for (const col of visibleColumns) {
        initial[col.name] = {
          value: '',
          isNull: col.nullable && !col.hasServerDefault,
          useDefault: col.hasServerDefault,
        }
      }
      setValues(initial)
    })
  }, [open, visibleColumns])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const result: Record<string, unknown> = {}
    for (const col of visibleColumns) {
      const colValue = values[col.name]
      if (!colValue) continue

      // Skip columns using default value (let DB handle it)
      if (colValue.useDefault) continue

      if (colValue.isNull) {
        result[col.name] = null
        continue
      }

      const rawValue = colValue.value
      if (rawValue === '') {
        // Empty string: treat as null if nullable, skip otherwise
        if (col.nullable) {
          result[col.name] = null
        }
        continue
      }

      result[col.name] = parseValue(rawValue, col)
    }

    onSubmit(result)
    onClose(false)
  }

  const handleChange = (columnName: string, value: ColumnValue) => {
    setValues((prev) => ({ ...prev, [columnName]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] min-h-[400px] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-sm font-medium">Add Row</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter values for the new row. Changes are staged until you save.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs table-fixed">
              <colgroup>
                <col className="w-[140px]" />
                <col className="w-[100px]" />
                <col />
                <col className="w-[52px]" />
                <col className="w-[52px]" />
              </colgroup>
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">
                    Column
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">
                    Value
                  </th>
                  <th className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground">
                    NULL
                  </th>
                  <th className="px-2 py-2 text-center text-[11px] font-medium text-muted-foreground">
                    Default
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {/* Required columns */}
                {requiredColumns.length > 0 && (
                  <tr className="bg-muted/30">
                    <td
                      colSpan={5}
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Required ({requiredColumns.length})
                    </td>
                  </tr>
                )}
                {requiredColumns.map((col) => (
                  <ColumnRow
                    key={col.name}
                    column={col}
                    value={values[col.name] ?? { value: '', isNull: false, useDefault: false }}
                    onChange={(value) => handleChange(col.name, value)}
                  />
                ))}

                {/* Optional columns */}
                {optionalColumns.length > 0 && (
                  <tr className="bg-muted/30">
                    <td
                      colSpan={5}
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Optional ({optionalColumns.length})
                    </td>
                  </tr>
                )}
                {optionalColumns.map((col) => (
                  <ColumnRow
                    key={col.name}
                    column={col}
                    value={values[col.name] ?? { value: '', isNull: false, useDefault: false }}
                    onChange={(value) => handleChange(col.name, value)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-border shrink-0">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Add Row
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Row Component ---

type ColumnRowProps = {
  column: ColumnInfo
  value: ColumnValue
  onChange: (value: ColumnValue) => void
}

function ColumnRow({ column, value, onChange }: ColumnRowProps) {
  const inputRef = useRef<HTMLInputElement | HTMLButtonElement>(null)
  const canBeNull = column.nullable
  const hasDefault = column.defaultValue !== null && !column.isAutoIncrement
  const isRequired = !column.nullable && !column.hasServerDefault
  const isInputDisabled = value.isNull || value.useDefault

  const handleValueChange = (newValue: string) => {
    onChange({ ...value, value: newValue, isNull: false, useDefault: false })
  }

  const handleNullToggle = () => {
    onChange({ ...value, isNull: !value.isNull, useDefault: false })
  }

  const handleDefaultToggle = () => {
    onChange({ ...value, useDefault: !value.useDefault, isNull: false })
  }

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't focus if clicking on a checkbox or button
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return
    }
    inputRef.current?.focus()
  }

  return (
    <tr className="hover:bg-muted/20 transition-colors cursor-text" onClick={handleRowClick}>
      {/* Column name */}
      <td className="px-3 py-2.5 align-middle">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium truncate" title={column.name}>
            {column.name}
          </span>
          {column.isPrimaryKey && (
            <span className="inline-flex items-center rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-medium text-amber-400 shrink-0">
              PK
            </span>
          )}
          {isRequired && <span className="text-rose-400 text-xs shrink-0">*</span>}
        </div>
      </td>

      {/* Data type */}
      <td className="px-3 py-2.5 align-middle">
        <span
          className="font-mono text-[11px] text-muted-foreground truncate block"
          title={column.dataType}
        >
          {column.dataType}
        </span>
      </td>

      {/* Value input */}
      <td className="px-3 py-2.5 align-middle">
        <CompactInput
          ref={inputRef}
          category={column.category}
          value={value.value}
          onChange={handleValueChange}
          disabled={isInputDisabled}
          placeholder={getPlaceholder(column, value)}
          defaultValue={column.defaultValue}
        />
      </td>

      {/* NULL checkbox */}
      <td className="px-2 py-2.5 text-center align-middle">
        {canBeNull ? (
          <input
            type="checkbox"
            checked={value.isNull}
            onChange={handleNullToggle}
            className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
            title="Set to NULL"
          />
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </td>

      {/* Default checkbox */}
      <td className="px-2 py-2.5 text-center align-middle">
        {hasDefault ? (
          <input
            type="checkbox"
            checked={value.useDefault}
            onChange={handleDefaultToggle}
            className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
            title={`Use default: ${column.defaultValue}`}
          />
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </td>
    </tr>
  )
}

// --- Compact Input Component ---

type CompactInputProps = {
  category: ColumnCategory
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  defaultValue: string | null
}

import { forwardRef } from 'react'

const CompactInput = forwardRef<HTMLInputElement | HTMLButtonElement, CompactInputProps>(
  function CompactInput({ category, value, onChange, disabled, placeholder, defaultValue }, ref) {
    switch (category) {
      case 'boolean':
        return (
          <BooleanInput
            ref={ref as React.Ref<HTMLButtonElement>}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        )
      case 'timestamp':
        return (
          <TimestampInput
            ref={ref as React.Ref<HTMLInputElement>}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            defaultValue={defaultValue}
          />
        )
      case 'date':
        return (
          <DateInput
            ref={ref as React.Ref<HTMLInputElement>}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
          />
        )
      case 'json':
        return (
          <JsonInput
            ref={ref as React.Ref<HTMLInputElement>}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
          />
        )
      default:
        return (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full rounded-md border border-border/50 bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/50"
          />
        )
    }
  },
)

const BooleanInput = forwardRef<
  HTMLButtonElement,
  {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
  }
>(function BooleanInput({ value, onChange, disabled }, ref) {
  const boolValue = value.toLowerCase()
  const isTrue = boolValue === 'true' || boolValue === 't' || boolValue === '1'
  const isFalse = boolValue === 'false' || boolValue === 'f' || boolValue === '0'

  return (
    <div className="flex gap-1.5">
      <button
        ref={isTrue || !isFalse ? ref : undefined}
        type="button"
        onClick={() => onChange('true')}
        disabled={disabled}
        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          isTrue
            ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        true
      </button>
      <button
        ref={isFalse ? ref : undefined}
        type="button"
        onClick={() => onChange('false')}
        disabled={disabled}
        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          isFalse
            ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        false
      </button>
    </div>
  )
})

const TimestampInput = forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
    defaultValue: string | null
  }
>(function TimestampInput({ value, onChange, disabled, placeholder, defaultValue }, ref) {
  const isNow = value === 'NOW()' || value === 'now()'
  const showNowButton =
    defaultValue?.toLowerCase().includes('now') ||
    defaultValue?.toLowerCase().includes('current_timestamp')

  return (
    <div className="flex gap-1.5">
      <input
        ref={ref}
        type="text"
        value={isNow ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isNow}
        placeholder={placeholder ?? 'YYYY-MM-DD HH:MM:SS'}
        className="flex-1 min-w-0 rounded-md border border-border/50 bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/50"
      />
      {showNowButton && (
        <button
          type="button"
          onClick={() => onChange(isNow ? '' : 'NOW()')}
          disabled={disabled}
          className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            isNow
              ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title="Use NOW()"
        >
          NOW()
        </button>
      )}
    </div>
  )
})

const DateInput = forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
  }
>(function DateInput({ value, onChange, disabled, placeholder }, ref) {
  const isToday = value === 'CURRENT_DATE' || value === 'current_date'

  return (
    <div className="flex gap-1.5">
      <input
        ref={ref}
        type="text"
        value={isToday ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isToday}
        placeholder={placeholder ?? 'YYYY-MM-DD'}
        className="flex-1 min-w-0 rounded-md border border-border/50 bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/50"
      />
      <button
        type="button"
        onClick={() => onChange(isToday ? '' : 'CURRENT_DATE')}
        disabled={disabled}
        className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
          isToday
            ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        title="Use CURRENT_DATE"
      >
        TODAY
      </button>
    </div>
  )
})

const JsonInput = forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
  }
>(function JsonInput({ value, onChange, disabled, placeholder }, ref) {
  let isValid = true
  if (value.trim() !== '') {
    try {
      JSON.parse(value)
    } catch {
      isValid = false
    }
  }

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder ?? '{"key": "value"}'}
      className={`w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/50 ${
        !isValid
          ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/50'
          : 'border-border/50 focus:border-primary focus:ring-primary/50'
      }`}
    />
  )
})

// --- Helpers ---

function getPlaceholder(column: ColumnInfo, value: ColumnValue): string {
  if (value.isNull) return 'NULL'
  if (value.useDefault) return column.defaultValue ?? 'DEFAULT'
  if (column.isAutoIncrement) return 'Auto-generated'
  return ''
}

function parseValue(value: string, column: ColumnInfo): unknown {
  // Handle SQL functions
  if (value === 'NOW()' || value === 'now()') {
    return { __sql: 'NOW()' }
  }
  if (value === 'CURRENT_DATE' || value === 'current_date') {
    return { __sql: 'CURRENT_DATE' }
  }

  const { category } = column

  if (category === 'integer') {
    const num = Number.parseInt(value, 10)
    return Number.isNaN(num) ? value : num
  }

  if (category === 'float') {
    const num = Number.parseFloat(value)
    return Number.isNaN(num) ? value : num
  }

  if (category === 'boolean') {
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === 't' || lower === '1') return true
    if (lower === 'false' || lower === 'f' || lower === '0') return false
    return value
  }

  if (category === 'json') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  // Timestamp: check if it looks like a unix timestamp (all digits)
  if (category === 'timestamp' && /^\d+$/.test(value)) {
    const ts = Number.parseInt(value, 10)
    // Convert to ISO string if it looks like seconds (10 digits) or milliseconds (13 digits)
    if (value.length <= 10) {
      return new Date(ts * 1000).toISOString()
    }
    return new Date(ts).toISOString()
  }

  return value
}
