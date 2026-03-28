import { useState } from 'react'
import type { ColumnCategory, ColumnInfo, ColumnValue } from '@/workbench/types/database'

type ColumnInputProps = {
  column: ColumnInfo
  value: ColumnValue
  onChange: (value: ColumnValue) => void
  disabled?: boolean
}

export function ColumnInput({ column, value, onChange, disabled }: ColumnInputProps) {
  const canBeNull = column.nullable
  const hasDefault = column.defaultValue !== null
  const showDefaultOption = hasDefault && !column.isAutoIncrement

  const handleValueChange = (newValue: string) => {
    onChange({ ...value, value: newValue, isNull: false, useDefault: false })
  }

  const handleNullToggle = () => {
    onChange({ ...value, isNull: !value.isNull, useDefault: false })
  }

  const handleDefaultToggle = () => {
    onChange({ ...value, useDefault: !value.useDefault, isNull: false })
  }

  const isInputDisabled = disabled || value.isNull || value.useDefault

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {canBeNull && (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={value.isNull}
              onChange={handleNullToggle}
              disabled={disabled}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <span className="text-muted-foreground">NULL</span>
          </label>
        )}
        {showDefaultOption && (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={value.useDefault}
              onChange={handleDefaultToggle}
              disabled={disabled}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <span className="text-muted-foreground">Use default</span>
          </label>
        )}
      </div>

      <InputByCategory
        category={column.category}
        value={value.value}
        onChange={handleValueChange}
        disabled={isInputDisabled}
        placeholder={getPlaceholder(column, value)}
      />
    </div>
  )
}

type InputByCategoryProps = {
  category: ColumnCategory
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

function InputByCategory({
  category,
  value,
  onChange,
  disabled,
  placeholder,
}: InputByCategoryProps) {
  switch (category) {
    case 'boolean':
      return <BooleanInput value={value} onChange={onChange} disabled={disabled} />
    case 'timestamp':
      return (
        <TimestampInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      )
    case 'date':
      return (
        <DateInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      )
    case 'integer':
      return (
        <NumberInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          isInteger
        />
      )
    case 'float':
      return (
        <NumberInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          isInteger={false}
        />
      )
    case 'json':
      return (
        <JsonInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      )
    default:
      return (
        <TextInput
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      )
  }
}

function BooleanInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const boolValue = value.toLowerCase()
  const isTrue = boolValue === 'true' || boolValue === 't' || boolValue === '1'
  const isFalse = boolValue === 'false' || boolValue === 'f' || boolValue === '0'

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('true')}
        disabled={disabled}
        className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          isTrue
            ? 'border-green-500 bg-green-500/20 text-green-400'
            : 'border-border bg-background text-muted-foreground hover:bg-muted'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        true
      </button>
      <button
        type="button"
        onClick={() => onChange('false')}
        disabled={disabled}
        className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          isFalse
            ? 'border-rose-500 bg-rose-500/20 text-rose-400'
            : 'border-border bg-background text-muted-foreground hover:bg-muted'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        false
      </button>
    </div>
  )
}

function TimestampInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const handleNowClick = () => {
    onChange('NOW()')
  }

  const handleManualChange = (newValue: string) => {
    onChange(newValue)
  }

  const isNow = value === 'NOW()' || value === 'now()'

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={isNow ? '' : value}
          onChange={(e) => handleManualChange(e.target.value)}
          disabled={disabled || isNow}
          placeholder={placeholder ?? 'YYYY-MM-DD HH:MM:SS or Unix timestamp'}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleNowClick}
          disabled={disabled}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            isNow
              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          NOW()
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter ISO format (2024-01-15 14:30:00) or Unix timestamp in seconds
      </p>
    </div>
  )
}

function DateInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const handleTodayClick = () => {
    onChange('CURRENT_DATE')
  }

  const handleManualChange = (newValue: string) => {
    onChange(newValue)
  }

  const isToday = value === 'CURRENT_DATE' || value === 'current_date'

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={isToday ? '' : value}
          onChange={(e) => handleManualChange(e.target.value)}
          disabled={disabled || isToday}
          placeholder={placeholder ?? 'YYYY-MM-DD'}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleTodayClick}
          disabled={disabled}
          className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            isToday
              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          TODAY
        </button>
      </div>
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  disabled,
  placeholder,
  isInteger,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  isInteger: boolean
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    // Allow empty, negative sign, or valid number patterns
    if (newValue === '' || newValue === '-') {
      onChange(newValue)
      return
    }

    if (isInteger) {
      if (/^-?\d*$/.test(newValue)) {
        onChange(newValue)
      }
    } else {
      if (/^-?\d*\.?\d*$/.test(newValue)) {
        onChange(newValue)
      }
    }
  }

  return (
    <input
      type="text"
      inputMode={isInteger ? 'numeric' : 'decimal'}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

function JsonInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [error, setError] = useState<string | null>(null)

  const handleChange = (newValue: string) => {
    onChange(newValue)
    if (newValue.trim() === '') {
      setError(null)
      return
    }
    try {
      JSON.parse(newValue)
      setError(null)
    } catch {
      setError('Invalid JSON')
    }
  }

  return (
    <div className="space-y-1">
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? '{"key": "value"}'}
        rows={3}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed ${
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
            : 'border-border focus:border-primary focus:ring-primary'
        }`}
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

function getPlaceholder(column: ColumnInfo, value: ColumnValue): string {
  if (value.isNull) return 'NULL'
  if (value.useDefault) return column.defaultValue ?? 'DEFAULT'
  if (column.isAutoIncrement) return 'Auto-generated'
  return ''
}
