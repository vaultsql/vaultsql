import type { ColumnInfo } from '@/workbench/types/database'

/**
 * Parse a string value into the appropriate type based on column info.
 * Used by the cell editor to convert user input into the correct data type.
 */
export function parseValue(value: string, column: ColumnInfo): unknown {
  // Empty string -> null if nullable
  if (value === '' && column.nullable) {
    return null
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

  return value
}
