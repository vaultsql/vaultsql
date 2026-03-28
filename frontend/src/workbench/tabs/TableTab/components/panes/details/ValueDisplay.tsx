import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { useState } from 'react'
import type { ColumnCategory, ForeignKeyInfo } from '@/workbench/types/database'
import { DetailValueRenderer } from './DetailValueRenderer'
import { formatValue } from './formatters'

type CopyableValueProps = {
  value: unknown
  category: ColumnCategory
}

/**
 * Display a value with a copy button that appears on hover.
 * Used for non-editable cells in the details pane.
 */
export function CopyableValue({ value, category }: CopyableValueProps) {
  const [copied, setCopied] = useState(false)
  const formatted = formatValue(value)

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted.copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-start gap-1.5">
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
      <div className="flex-1 min-w-0">
        <DetailValueRenderer value={value} category={category} />
      </div>
    </div>
  )
}

type ForeignKeyCellProps = {
  value: unknown
  fk: ForeignKeyInfo
  isExpanded: boolean
  onToggle: () => void
}

/**
 * Display a foreign key value with expand/collapse chevron and copy button.
 * Clicking the value toggles expansion to show the referenced row.
 */
export function ForeignKeyCell({ value, fk, isExpanded, onToggle }: ForeignKeyCellProps) {
  const [copied, setCopied] = useState(false)
  const formatted = formatValue(value)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(formatted.copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-start gap-1.5">
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
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
        title={`${isExpanded ? 'Collapse' : 'Expand'} ${fk.refSchema}.${fk.refTable}`}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="break-all">{formatted.display}</span>
      </button>
    </div>
  )
}
