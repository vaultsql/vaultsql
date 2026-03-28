import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Checkbox } from '@/components/catalyst/checkbox'
import { Input } from '@/components/catalyst/input'
import { Textarea } from '@/components/catalyst/textarea'
import type { ColumnCategory, ColumnValue } from '@/workbench/types/database'

type DataInputProps = {
  dataType: ColumnCategory
  nullable: boolean
  hasDefault: boolean
  value: ColumnValue
  onChange: (value: ColumnValue) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * DataInput - A simplified, decoupled input component for database column values.
 *
 * Handles three states:
 * 1. NULL - when nullable is true and user checks NULL
 * 2. DEFAULT - when hasDefault is true and user checks "Use default"
 * 3. VALUE - user provides actual value via type-specific input
 *
 * The component is responsible ONLY for value input - no labels, no metadata display.
 */
export function DataInput({
  dataType,
  nullable,
  hasDefault,
  value,
  onChange,
  disabled,
  placeholder,
}: DataInputProps) {
  // When value.isNull or value.useDefault is true, the actual input is disabled
  const isInputDisabled = disabled || value.isNull || value.useDefault

  // Handler for actual value changes - clears NULL and DEFAULT flags
  const handleValueChange = (newValue: string) => {
    onChange({ ...value, value: newValue, isNull: false, useDefault: false })
  }

  // Toggle NULL state - clears DEFAULT flag
  const handleNullToggle = () => {
    onChange({ ...value, isNull: !value.isNull, useDefault: false })
  }

  // Toggle DEFAULT state - clears NULL flag
  const handleDefaultToggle = () => {
    onChange({ ...value, useDefault: !value.useDefault, isNull: false })
  }

  return (
    <div className="space-y-2">
      {/* Checkboxes row - only shown when applicable */}
      {(nullable || hasDefault) && (
        <div className="flex items-center gap-4">
          {/* NULL checkbox - only shown for nullable columns */}
          {nullable && (
            <Checkbox
              checked={value.isNull}
              onChange={handleNullToggle}
              disabled={disabled}
              className="group flex items-center gap-2"
            >
              <span className="text-xs text-muted-foreground group-data-checked:text-foreground">
                NULL
              </span>
            </Checkbox>
          )}

          {/* DEFAULT checkbox - only shown when column has a default value */}
          {hasDefault && (
            <Checkbox
              checked={value.useDefault}
              onChange={handleDefaultToggle}
              disabled={disabled}
              className="group flex items-center gap-2"
            >
              <span className="text-xs text-muted-foreground group-data-checked:text-foreground">
                Use default
              </span>
            </Checkbox>
          )}
        </div>
      )}

      {/* Type-specific input - delegates to specialized input components */}
      <InputByDataType
        dataType={dataType}
        value={value.value}
        onChange={handleValueChange}
        disabled={isInputDisabled}
        placeholder={placeholder}
      />
    </div>
  )
}

type InputByDataTypeProps = {
  dataType: ColumnCategory
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Routes to appropriate input component based on data type category.
 * Each specialized input handles validation and formatting for its type.
 */
function InputByDataType({
  dataType,
  value,
  onChange,
  disabled,
  placeholder,
}: InputByDataTypeProps) {
  switch (dataType) {
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

// Boolean input - toggle buttons for true/false
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
      {isTrue ? (
        <Button
          className="flex-1"
          color="green"
          onClick={() => onChange('true')}
          disabled={disabled}
        >
          true
        </Button>
      ) : (
        <Button className="flex-1" outline onClick={() => onChange('true')} disabled={disabled}>
          true
        </Button>
      )}
      {isFalse ? (
        <Button
          className="flex-1"
          color="rose"
          onClick={() => onChange('false')}
          disabled={disabled}
        >
          false
        </Button>
      ) : (
        <Button className="flex-1" outline onClick={() => onChange('false')} disabled={disabled}>
          false
        </Button>
      )}
    </div>
  )
}

// Timestamp input - text input with NOW() button for current timestamp
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
  const isNow = value === 'NOW()' || value === 'now()'

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          value={isNow ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isNow}
          placeholder={placeholder ?? 'YYYY-MM-DD HH:MM:SS or Unix timestamp'}
          className="flex-1 font-mono"
        />
        {isNow ? (
          <Button color="blue" onClick={() => onChange('NOW()')} disabled={disabled}>
            NOW()
          </Button>
        ) : (
          <Button outline onClick={() => onChange('NOW()')} disabled={disabled}>
            NOW()
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Enter ISO format (2024-01-15 14:30:00) or Unix timestamp in seconds
      </p>
    </div>
  )
}

// Date input - text input with TODAY button for current date
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
  const isToday = value === 'CURRENT_DATE' || value === 'current_date'

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          value={isToday ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isToday}
          placeholder={placeholder ?? 'YYYY-MM-DD'}
          className="flex-1 font-mono"
        />
        {isToday ? (
          <Button color="blue" onClick={() => onChange('CURRENT_DATE')} disabled={disabled}>
            TODAY
          </Button>
        ) : (
          <Button outline onClick={() => onChange('CURRENT_DATE')} disabled={disabled}>
            TODAY
          </Button>
        )}
      </div>
    </div>
  )
}

// Number input - validates integer or float patterns
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

    // Allow empty or negative sign
    if (newValue === '' || newValue === '-') {
      onChange(newValue)
      return
    }

    // Validate based on integer/float type
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
    <Input
      type="text"
      inputMode={isInteger ? 'numeric' : 'decimal'}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      className="font-mono"
    />
  )
}

// JSON input - textarea with validation
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

    // Validate JSON if not empty
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
      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? '{"key": "value"}'}
        rows={3}
        className={`w-full font-mono ${
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' // Note: Textarea component might not accept these classes directly if it styles itself rigidly, but we try.
            : ''
        }`}
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  )
}

// Text input - default fallback for all other types
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
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="font-mono"
    />
  )
}
