import { useCallback, useMemo, useRef, useState } from 'react'
import type { GridSelectionState } from './types'

type UseGridSelectionOptions = {
  /** All row keys in order */
  rowKeys: string[]
  /** Controlled selected rows (optional - uses internal state if not provided) */
  selectedRows?: Set<string>
  /** Callback when selection changes */
  onSelectionChange?: (selected: Set<string>) => void
}

/**
 * Hook for managing row selection in a grid.
 * Supports single click, Shift+Click range selection, and Ctrl/Cmd+Click toggle.
 */
export function useGridSelection({
  rowKeys,
  selectedRows: controlledSelectedRows,
  onSelectionChange,
}: UseGridSelectionOptions): GridSelectionState {
  // Internal state for uncontrolled mode
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string>>(new Set())

  // Track the last selected row for Shift+Click range selection
  const lastSelectedRef = useRef<string | null>(null)

  // Use controlled or internal state
  const selectedRows = controlledSelectedRows ?? internalSelectedRows
  const isControlled = controlledSelectedRows !== undefined

  const updateSelection = useCallback(
    (newSelection: Set<string>) => {
      if (!isControlled) {
        setInternalSelectedRows(newSelection)
      }
      onSelectionChange?.(newSelection)
    },
    [isControlled, onSelectionChange],
  )

  const isSelected = useCallback((rowKey: string) => selectedRows.has(rowKey), [selectedRows])

  const isAllSelected = useMemo(
    () => rowKeys.length > 0 && selectedRows.size === rowKeys.length,
    [rowKeys.length, selectedRows.size],
  )

  const isSomeSelected = useMemo(
    () => selectedRows.size > 0 && selectedRows.size < rowKeys.length,
    [selectedRows.size, rowKeys.length],
  )

  const toggleRow = useCallback(
    (rowKey: string, shiftKey = false) => {
      const newSelection = new Set(selectedRows)

      if (shiftKey && lastSelectedRef.current) {
        // Range selection: select all rows between last selected and current
        const lastIndex = rowKeys.indexOf(lastSelectedRef.current)
        const currentIndex = rowKeys.indexOf(rowKey)

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex)
          const end = Math.max(lastIndex, currentIndex)

          for (let i = start; i <= end; i++) {
            newSelection.add(rowKeys[i])
          }
        }
      } else {
        // Toggle single row
        if (newSelection.has(rowKey)) {
          newSelection.delete(rowKey)
        } else {
          newSelection.add(rowKey)
        }
        lastSelectedRef.current = rowKey
      }

      updateSelection(newSelection)
    },
    [selectedRows, rowKeys, updateSelection],
  )

  const selectAll = useCallback(() => {
    updateSelection(new Set(rowKeys))
    lastSelectedRef.current = null
  }, [rowKeys, updateSelection])

  const clearSelection = useCallback(() => {
    updateSelection(new Set())
    lastSelectedRef.current = null
  }, [updateSelection])

  const selectRange = useCallback(
    (fromKey: string, toKey: string) => {
      const fromIndex = rowKeys.indexOf(fromKey)
      const toIndex = rowKeys.indexOf(toKey)

      if (fromIndex === -1 || toIndex === -1) return

      const start = Math.min(fromIndex, toIndex)
      const end = Math.max(fromIndex, toIndex)
      const newSelection = new Set<string>()

      for (let i = start; i <= end; i++) {
        newSelection.add(rowKeys[i])
      }

      updateSelection(newSelection)
      lastSelectedRef.current = toKey
    },
    [rowKeys, updateSelection],
  )

  return {
    selectedRows,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleRow,
    selectAll,
    clearSelection,
    selectRange,
  }
}
