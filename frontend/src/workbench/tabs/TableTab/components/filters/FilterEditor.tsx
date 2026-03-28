import { useMemo, useState } from 'react'
import type { ColumnInfo, Filter, FilterOperator } from '@/workbench/types/database'
import {
  getDefaultOperator,
  getOperatorsForCategory,
  operatorNeedsValue,
} from '@/workbench/types/database'

type FilterEditorProps = {
  filter: Filter | null // null = creating new filter
  columns: ColumnInfo[]
  onSave: (filter: Filter) => void
  onCancel: () => void
}

export function FilterEditor({ filter, columns, onSave, onCancel }: FilterEditorProps) {
  const defaultColumn = columns[0]
  const defaultOperator = defaultColumn ? getDefaultOperator(defaultColumn.category) : 'eq'

  const [column, setColumn] = useState<string>(filter?.column ?? defaultColumn?.name ?? '')
  const [operator, setOperator] = useState<FilterOperator>(filter?.operator ?? defaultOperator)
  const [value, setValue] = useState<string>(filter?.value ?? '')

  const columnInfo = useMemo(() => columns.find((c) => c.name === column), [columns, column])
  const operators = useMemo(
    () => getOperatorsForCategory(columnInfo?.category ?? 'other'),
    [columnInfo],
  )
  const needsValue = operatorNeedsValue(operator)

  const handleColumnChange = (newColumnName: string) => {
    setColumn(newColumnName)

    // Reset operator if current one isn't valid for new column
    const newColumnInfo = columns.find((c) => c.name === newColumnName)
    const newOperators = getOperatorsForCategory(newColumnInfo?.category ?? 'other')
    const currentOperatorValid = newOperators.some((op) => op.operator === operator)
    if (!currentOperatorValid) {
      setOperator(newOperators[0]?.operator ?? 'eq')
    }
  }

  const handleOperatorChange = (newOperator: FilterOperator) => {
    setOperator(newOperator)
    // Clear value if operator doesn't need it
    if (!operatorNeedsValue(newOperator)) {
      setValue('')
    }
  }

  const handleSave = () => {
    if (!column) return

    onSave({
      id: filter?.id ?? crypto.randomUUID(),
      column,
      operator,
      value: needsValue ? value : '',
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="w-64 space-y-3" onKeyDown={handleKeyDown}>
      <div>
        <label htmlFor="filter-column" className="mb-1 block text-xs font-medium text-foreground">
          Column
        </label>
        <select
          id="filter-column"
          value={column}
          onChange={(e) => handleColumnChange(e.target.value)}
          className="wb-select w-full"
          autoFocus
        >
          {columns.map((col) => (
            <option key={col.name} value={col.name}>
              {col.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="filter-operator" className="mb-1 block text-xs font-medium text-foreground">
          Operator
        </label>
        <select
          id="filter-operator"
          value={operator}
          onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
          className="wb-select w-full"
        >
          {operators.map((op) => (
            <option key={op.operator} value={op.operator}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {needsValue && (
        <div>
          <label htmlFor="filter-value" className="mb-1 block text-xs font-medium text-foreground">
            Value
          </label>
          <input
            id="filter-value"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={getPlaceholder(columnInfo, operator)}
            className="wb-input w-full"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="wb-btn wb-btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={handleSave} className="wb-btn wb-btn-primary">
          {filter ? 'Update' : 'Add'}
        </button>
      </div>
    </div>
  )
}

function getPlaceholder(column: ColumnInfo | undefined, operator: FilterOperator): string {
  if (operator === 'in') {
    return 'value1, value2, ...'
  }
  if (operator === 'contains' || operator === 'icontains') {
    return 'search text'
  }

  if (!column) return 'Enter value'

  switch (column.category) {
    case 'integer':
    case 'float':
      return '0'
    case 'boolean':
      return 'true or false'
    case 'date':
      return 'YYYY-MM-DD'
    case 'timestamp':
      return 'YYYY-MM-DD HH:MM:SS'
    case 'time':
      return 'HH:MM:SS'
    case 'uuid':
      return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
    default:
      return 'Enter value'
  }
}
