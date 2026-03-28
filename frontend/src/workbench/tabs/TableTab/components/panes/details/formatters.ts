import { DETAIL_VALUE_JSON_MAX_DEPTH } from '@/workbench/constants'
import type { ColumnCategory } from '@/workbench/types/database'

/**
 * Formatted value with metadata for display and copying.
 * This type allows future extensions for type-specific formatting
 * (dates, JSON, arrays, etc.) without changing component interfaces.
 */
export type FormattedValue = {
  display: string // What to render in the UI
  copyText: string // What to copy to clipboard
  isNull: boolean // For NULL styling
  truncated?: boolean // For long values (future use)
}

/**
 * Format a database value for display.
 *
 * @param value - The raw value from the database
 * @param category - Optional column category for type-aware formatting (future use)
 * @returns Formatted value with display and copy text
 */
export function formatValue(value: unknown, category?: ColumnCategory): FormattedValue {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return {
      display: 'NULL',
      copyText: 'NULL',
      isNull: true,
    }
  }

  // Handle objects (JSON, arrays, etc.)
  if (typeof value === 'object') {
    const jsonString = JSON.stringify(value, null, 2)
    return {
      display: jsonString,
      copyText: jsonString,
      isNull: false,
    }
  }

  // Handle primitives
  const stringValue = String(value)
  return {
    display: stringValue,
    copyText: stringValue,
    isNull: false,
  }
}

/**
 * Format a key display for the details pane header.
 * Simplified format: table.column = value
 *
 * @param table - Table name
 * @param column - Column name
 * @param value - Column value
 * @returns Formatted string like "users.id = 123"
 */
export function formatKeyDisplay(table: string, column: string, value: unknown): string {
  const formattedValue = typeof value === 'string' ? `'${value}'` : String(value)
  return `${table}.${column} = ${formattedValue}`
}

/**
 * Format a simplified key display (without column name).
 * Format: table = value
 *
 * @param table - Table name
 * @param value - Column value
 * @returns Formatted string like "users = 123"
 */
export function formatSimpleKeyDisplay(table: string, value: unknown): string {
  const formattedValue = typeof value === 'string' ? `'${value}'` : String(value)
  return `${table} = ${formattedValue}`
}

/**
 * Truncate text at a maximum length with smart word boundary detection.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Object with truncated text and whether it was truncated
 */
export function truncateText(
  text: string,
  maxLength: number,
): { text: string; isTruncated: boolean } {
  if (text.length <= maxLength) {
    return { text, isTruncated: false }
  }

  // Try to truncate at a word boundary within the last 20% of maxLength
  const searchStart = Math.floor(maxLength * 0.8)
  const lastSpace = text.lastIndexOf(' ', maxLength)

  if (lastSpace > searchStart) {
    return { text: `${text.slice(0, lastSpace)}...`, isTruncated: true }
  }

  // No good word boundary, just cut at maxLength
  return { text: `${text.slice(0, maxLength)}...`, isTruncated: true }
}

/**
 * Format a timestamp value for human-readable display.
 * Handles various timestamp formats (ISO strings, Date objects, unix timestamps).
 *
 * @param value - The timestamp value
 * @returns Formatted timestamp string or original value if not a valid timestamp
 */
export function formatTimestamp(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  let date: Date | null = null

  // Try to parse as Date
  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string') {
    // Try parsing ISO string
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed
    }
  } else if (typeof value === 'number') {
    // Unix timestamp (assume milliseconds if > 10000000000, else seconds)
    const timestamp = value > 10000000000 ? value : value * 1000
    date = new Date(timestamp)
  }

  if (!date || Number.isNaN(date.getTime())) {
    return String(value)
  }

  // Format: "Jan 15, 2024, 2:30 PM"
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Format a date value for human-readable display.
 *
 * @param value - The date value
 * @returns Formatted date string or original value if not a valid date
 */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  let date: Date | null = null

  if (value instanceof Date) {
    date = value
  } else if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed
    }
  }

  if (!date || Number.isNaN(date.getTime())) {
    return String(value)
  }

  // Format: "Jan 15, 2024"
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/**
 * Format a time value for display.
 *
 * @param value - The time value
 * @returns Formatted time string
 */
export function formatTime(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  // Time values are typically strings like "14:30:00"
  return String(value)
}

/**
 * Format a number for display with locale-aware formatting.
 *
 * @param value - The number value
 * @param isFloat - Whether this is a float (adds decimal places)
 * @returns Formatted number string
 */
export function formatNumber(value: unknown, isFloat = false): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  const num = typeof value === 'number' ? value : Number(value)

  if (Number.isNaN(num)) {
    return String(value)
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: isFloat ? 10 : 0,
    minimumFractionDigits: 0,
  }).format(num)
}

/**
 * Lightweight JSON pretty-printer with depth limiting.
 * Formats JSON with proper indentation but stops at max depth to prevent
 * massive output from deeply nested structures.
 *
 * @param value - The value to format as JSON
 * @param maxDepth - Maximum nesting depth (default from constants)
 * @returns Pretty-formatted JSON string
 */
export function formatJsonPretty(value: unknown, maxDepth = DETAIL_VALUE_JSON_MAX_DEPTH): string {
  function stringify(val: unknown, depth: number): string {
    if (val === null) return 'null'
    if (val === undefined) return 'undefined'

    const type = typeof val

    // Primitives
    if (type === 'string') return JSON.stringify(val)
    if (type === 'number' || type === 'boolean') return String(val)

    // Stop at max depth
    if (depth >= maxDepth) {
      if (Array.isArray(val)) return `[...${val.length} items]`
      if (type === 'object') return '{...}'
      return String(val)
    }

    const indent = '  '.repeat(depth)
    const nextIndent = '  '.repeat(depth + 1)

    // Arrays
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]'
      const items = val.map((item) => `${nextIndent}${stringify(item, depth + 1)}`).join(',\n')
      return `[\n${items}\n${indent}]`
    }

    // Objects
    if (type === 'object') {
      const entries = Object.entries(val)
      if (entries.length === 0) return '{}'
      const items = entries
        .map(
          ([key, value]) => `${nextIndent}${JSON.stringify(key)}: ${stringify(value, depth + 1)}`,
        )
        .join(',\n')
      return `{\n${items}\n${indent}}`
    }

    return String(val)
  }

  return stringify(value, 0)
}

/**
 * Count the number of lines in a string.
 *
 * @param text - The text to count lines in
 * @returns Number of lines
 */
export function countLines(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

/**
 * Truncate text to a maximum number of lines.
 *
 * @param text - The text to truncate
 * @param maxLines - Maximum number of lines
 * @returns Object with truncated text and whether it was truncated
 */
export function truncateLines(
  text: string,
  maxLines: number,
): { text: string; isTruncated: boolean } {
  const lines = text.split('\n')

  if (lines.length <= maxLines) {
    return { text, isTruncated: false }
  }

  return {
    text: `${lines.slice(0, maxLines).join('\n')}\n...`,
    isTruncated: true,
  }
}
