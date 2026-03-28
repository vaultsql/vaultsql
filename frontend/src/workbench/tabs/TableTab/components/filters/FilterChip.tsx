import { X } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ColumnInfo, Filter } from '@/workbench/types/database'
import { getOperatorLabel, operatorNeedsValue } from '@/workbench/types/database'
import { FilterEditor } from './FilterEditor'

type FilterChipProps = {
  filter: Filter
  columns: ColumnInfo[]
  onUpdate: (filter: Filter) => void
  onRemove: () => void
}

export function FilterChip({ filter, columns, onUpdate, onRemove }: FilterChipProps) {
  const [open, setOpen] = useState(false)

  const handleSave = (updated: Filter) => {
    onUpdate(updated)
    setOpen(false)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRemove()
  }

  const operatorLabel = getOperatorLabel(filter.operator)
  const needsValue = operatorNeedsValue(filter.operator)

  // Format display text: "column op value" or "column op" for null checks
  const displayText = needsValue
    ? `${filter.column} ${operatorLabel} ${filter.value || '…'}`
    : `${filter.column} ${operatorLabel}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="wb-filter-chip"
          title={displayText}
        >
          <span className="wb-filter-chip-text">{displayText}</span>
          <span
            role="button"
            tabIndex={0}
            className="wb-filter-chip-remove"
            onClick={handleRemove}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onRemove()
              }
            }}
            title="Remove filter"
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <FilterEditor
          filter={filter}
          columns={columns}
          onSave={handleSave}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
