import { forwardRef } from 'react'
import type { ColumnCategory } from '@/workbench/types/database'

type TypedInputProps = {
  category: ColumnCategory
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  compact?: boolean
}

/**
 * Type-aware input component that renders different UI based on column category.
 * For booleans, shows toggle buttons. For all other types, shows a text input.
 */
export const TypedInput = forwardRef<HTMLInputElement, TypedInputProps>(function TypedInput(
  { category, value, onChange, onKeyDown, compact = false },
  ref,
) {
  // Boolean gets special toggle UI
  if (category === 'boolean') {
    const boolValue = value.toLowerCase()
    const isTrue = boolValue === 'true' || boolValue === 't' || boolValue === '1'
    const isFalse = boolValue === 'false' || boolValue === 'f' || boolValue === '0'

    return (
      <div className="flex gap-1 flex-1">
        <button
          type="button"
          onClick={() => onChange('true')}
          onKeyDown={onKeyDown}
          className={`flex-1 rounded ${compact ? 'px-1 py-0' : 'px-2 py-1'} text-xs font-medium transition-colors ${
            isTrue
              ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          true
        </button>
        <button
          type="button"
          onClick={() => onChange('false')}
          onKeyDown={onKeyDown}
          className={`flex-1 rounded ${compact ? 'px-1 py-0' : 'px-2 py-1'} text-xs font-medium transition-colors ${
            isFalse
              ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          false
        </button>
      </div>
    )
  }

  // All other types use a text input
  return (
    <input
      ref={ref}
      type="text"
      size={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={`flex-1 min-w-0 w-full rounded border-0 bg-background ${
        compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
      } font-mono outline-none focus:ring-2 focus:ring-primary/50`}
      placeholder={getPlaceholder(category)}
    />
  )
})

function getPlaceholder(category: ColumnCategory): string {
  switch (category) {
    case 'timestamp':
      return 'YYYY-MM-DD HH:MM:SS'
    case 'date':
      return 'YYYY-MM-DD'
    case 'time':
      return 'HH:MM:SS'
    case 'json':
      return '{"key": "value"}'
    default:
      return ''
  }
}
