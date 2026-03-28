/**
 * Utility functions for TableDataGrid formatting and data manipulation
 */

/**
 * Safely stringify a value, handling bigints and circular references
 */
export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)) ?? ''
  } catch {
    return String(value)
  }
}

/**
 * Format a value for clipboard copying
 */
export function formatClipboardValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object') return safeStringify(value)
  return String(value)
}

/**
 * Format a value for use in filter inputs
 */
export function formatFilterValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'object') return safeStringify(value)
  return String(value)
}
