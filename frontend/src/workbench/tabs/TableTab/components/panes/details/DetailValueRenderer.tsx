import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import {
  DETAIL_VALUE_MAX_ARRAY_ITEMS,
  DETAIL_VALUE_MAX_LENGTH,
  DETAIL_VALUE_MAX_LINES,
  DETAIL_VALUE_TRUNCATE_LENGTH,
} from '@/workbench/constants'
import type { ColumnCategory } from '@/workbench/types/database'
import {
  countLines,
  formatDate,
  formatJsonPretty,
  formatNumber,
  formatTime,
  formatTimestamp,
  truncateLines,
  truncateText,
} from './formatters'

type DetailValueRendererProps = {
  value: unknown
  category: ColumnCategory
  maxLength?: number
  maxLines?: number
}

/**
 * Generic value renderer for the details pane.
 * Renders values based on their ColumnCategory with appropriate formatting,
 * truncation, and styling.
 */
export function DetailValueRenderer({
  value,
  category,
  maxLength = DETAIL_VALUE_TRUNCATE_LENGTH,
  maxLines = DETAIL_VALUE_MAX_LINES,
}: DetailValueRendererProps) {
  // Handle NULL first
  if (value === null || value === undefined) {
    return <NullValue />
  }

  // Route to appropriate renderer based on category
  switch (category) {
    case 'boolean':
      return <BooleanValue value={value} />
    case 'json':
      return <JsonValue value={value} />
    case 'array':
      return <ArrayValue value={value} />
    case 'timestamp':
      return <TimestampValue value={value} />
    case 'date':
      return <DateValue value={value} />
    case 'time':
      return <TimeValue value={value} />
    case 'integer':
      return <NumberValue value={value} isFloat={false} />
    case 'float':
      return <NumberValue value={value} isFloat={true} />
    case 'uuid':
      return <UuidValue value={value} />
    case 'text':
    case 'other':
    default:
      return <TextValue value={value} maxLength={maxLength} maxLines={maxLines} />
  }
}

// --- Sub-renderers ---

function NullValue() {
  return (
    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
      NULL
    </span>
  )
}

function BooleanValue({ value }: { value: unknown }) {
  const boolValue = Boolean(value)

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
        boolValue
          ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
          : 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30'
      }`}
    >
      {boolValue ? 'true' : 'false'}
    </span>
  )
}

function JsonValue({ value }: { value: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Use lightweight pretty formatter
  const jsonString = typeof value === 'object' ? formatJsonPretty(value) : String(value)

  // Apply line limit (even when expanded, cap at max lines)
  const lineCount = countLines(jsonString)
  const { text: limitedJson, isTruncated: lineTruncated } = truncateLines(
    jsonString,
    DETAIL_VALUE_MAX_LINES,
  )

  // Also apply character limit
  const cappedJson =
    limitedJson.length > DETAIL_VALUE_MAX_LENGTH
      ? `${limitedJson.slice(0, DETAIL_VALUE_MAX_LENGTH)}...`
      : limitedJson

  const wasTruncated = lineTruncated || cappedJson.length < jsonString.length

  // Check if it's a complex JSON (more than one line)
  const isComplex = jsonString.includes('\n')

  if (!isComplex) {
    // Simple JSON, just display inline
    return <span className="font-mono text-xs text-purple-400">{jsonString}</span>
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="text-xs font-medium">
          {isExpanded ? 'Collapse' : 'Expand'} JSON
          {wasTruncated && ` (${lineCount} lines)`}
        </span>
      </button>
      {isExpanded && (
        <pre className="rounded bg-muted/50 p-2 text-xs overflow-x-auto max-h-96 overflow-y-auto">
          <code className="text-purple-400">{cappedJson}</code>
          {wasTruncated && (
            <div className="mt-2 text-xs text-muted-foreground italic">
              (truncated at {DETAIL_VALUE_MAX_LINES} lines / {DETAIL_VALUE_MAX_LENGTH} chars)
            </div>
          )}
        </pre>
      )}
    </div>
  )
}

function ArrayValue({ value }: { value: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Parse array
  let items: unknown[] = []
  if (Array.isArray(value)) {
    items = value
  } else if (typeof value === 'string') {
    // Try parsing PostgreSQL array format like "{1,2,3}"
    try {
      // Simple parsing for basic arrays
      const cleaned = value.replace(/^\{|\}$/g, '')
      items = cleaned.split(',').map((item) => item.trim())
    } catch {
      // Fallback to displaying as string
      return <span className="break-all">{String(value)}</span>
    }
  }

  const count = items.length
  const displayItems = items.slice(0, DETAIL_VALUE_MAX_ARRAY_ITEMS)
  const isTruncated = count > DETAIL_VALUE_MAX_ARRAY_ITEMS

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/30">
          Array [{count}]
        </span>
        {count > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="text-xs">{isExpanded ? 'Hide' : 'Show'} items</span>
          </button>
        )}
      </div>
      {isExpanded && count > 0 && (
        <div className="rounded bg-muted/50 p-2">
          <ul className="space-y-1 text-xs max-h-96 overflow-y-auto">
            {displayItems.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">[{idx}]</span>
                <span className="break-all">{String(item)}</span>
              </li>
            ))}
          </ul>
          {isTruncated && (
            <div className="mt-2 text-xs text-muted-foreground italic">
              (showing first {DETAIL_VALUE_MAX_ARRAY_ITEMS} of {count} items)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TimestampValue({ value }: { value: unknown }) {
  const formatted = formatTimestamp(value)
  const original = String(value)

  return (
    <span className="text-amber-400" title={original}>
      {formatted}
    </span>
  )
}

function DateValue({ value }: { value: unknown }) {
  const formatted = formatDate(value)
  const original = String(value)

  return (
    <span className="text-amber-400" title={original}>
      {formatted}
    </span>
  )
}

function TimeValue({ value }: { value: unknown }) {
  const formatted = formatTime(value)

  return <span className="text-amber-400">{formatted}</span>
}

function NumberValue({ value, isFloat }: { value: unknown; isFloat: boolean }) {
  const formatted = formatNumber(value, isFloat)

  return <span className="tabular-nums">{formatted}</span>
}

function UuidValue({ value }: { value: unknown }) {
  return <span className="font-mono text-xs text-cyan-400">{String(value)}</span>
}

function TextValue({
  value,
  maxLength,
  maxLines,
}: {
  value: unknown
  maxLength: number
  maxLines: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const text = String(value)

  // Handle empty string
  if (text === '') {
    return <span className="italic text-muted-foreground text-xs">(empty string)</span>
  }

  // Handle whitespace-only strings
  if (text.trim() === '') {
    return (
      <span className="italic text-muted-foreground text-xs">
        (whitespace: {text.length} chars)
      </span>
    )
  }

  // Hard cap at DETAIL_VALUE_MAX_LENGTH for performance
  const hardCappedText =
    text.length > DETAIL_VALUE_MAX_LENGTH ? `${text.slice(0, DETAIL_VALUE_MAX_LENGTH)}...` : text

  // For collapsed view: truncate by both length and lines
  const { text: charTruncated, isTruncated: charTrunc } = truncateText(hardCappedText, maxLength)
  const { text: truncated, isTruncated: lineTrunc } = truncateLines(charTruncated, maxLines)
  const isTruncated = charTrunc || lineTrunc

  // For expanded view: only apply line limit
  const { text: expandedText, isTruncated: expandedTrunc } = truncateLines(hardCappedText, maxLines)

  // Check if text has newlines
  const hasNewlines = text.includes('\n')
  const lineCount = countLines(text)

  if (!isTruncated && !hasNewlines) {
    // Short text without newlines, display inline
    return <span className="break-all">{text}</span>
  }

  return (
    <div className="space-y-1">
      {!isExpanded ? (
        <span className="break-all whitespace-pre-wrap">{truncated}</span>
      ) : (
        <div>
          <pre className="whitespace-pre-wrap break-all text-xs max-h-96 overflow-y-auto rounded bg-muted/50 p-2">
            {expandedText}
          </pre>
          {expandedTrunc && (
            <div className="mt-1 text-xs text-muted-foreground italic">
              (truncated at {maxLines} lines / {DETAIL_VALUE_MAX_LENGTH} chars, original:{' '}
              {lineCount} lines / {text.length} chars)
            </div>
          )}
        </div>
      )}
      {isTruncated && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
