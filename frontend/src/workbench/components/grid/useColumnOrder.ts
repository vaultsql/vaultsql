import { arrayMove } from '@dnd-kit/sortable'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'column-order:'

/**
 * Hook for managing column order with localStorage persistence.
 *
 * @param storageKey - Unique key for localStorage (e.g., "table:public.users" or "query:abc123")
 * @param defaultColumns - The default column order from the data source
 * @returns Column order state and manipulation functions
 */
export function useColumnOrder(storageKey: string | null, defaultColumns: string[]) {
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (!storageKey) return defaultColumns

    const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`)
    if (!stored) return defaultColumns

    try {
      const parsed = JSON.parse(stored) as string[]
      // Validate that stored order contains valid columns
      if (Array.isArray(parsed) && parsed.length > 0) {
        return reconcileColumns(parsed, defaultColumns)
      }
    } catch {
      // Invalid JSON, use defaults
    }
    return defaultColumns
  })

  // Sync when defaultColumns change (new query result, table switch, etc.)
  useEffect(() => {
    setColumnOrder((current) => reconcileColumns(current, defaultColumns))
  }, [defaultColumns])

  // Persist to localStorage when order changes
  useEffect(() => {
    if (!storageKey) return

    // Only persist if order differs from default
    const isDefaultOrder = columnOrder.every((col, i) => col === defaultColumns[i])
    if (isDefaultOrder) {
      localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`)
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(columnOrder))
    }
  }, [storageKey, columnOrder, defaultColumns])

  const reorder = useCallback((activeId: string, overId: string) => {
    setColumnOrder((items) => {
      const oldIndex = items.indexOf(activeId)
      const newIndex = items.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }, [])

  const reset = useCallback(() => {
    setColumnOrder(defaultColumns)
  }, [defaultColumns])

  return {
    /** Columns in current display order */
    orderedColumns: columnOrder,
    /** Reorder a column from one position to another */
    reorder,
    /** Reset to default column order */
    reset,
    /** Whether order differs from default */
    isCustomOrder: !columnOrder.every((col, i) => col === defaultColumns[i]),
  }
}

/**
 * Reconcile stored column order with current columns.
 * - Preserves order of columns that still exist
 * - Appends new columns at the end
 * - Removes columns that no longer exist
 */
function reconcileColumns(stored: string[], current: string[]): string[] {
  const currentSet = new Set(current)
  const storedSet = new Set(stored)

  // Keep stored columns that still exist, in their stored order
  const kept = stored.filter((col) => currentSet.has(col))

  // Add new columns that weren't in stored order
  const added = current.filter((col) => !storedSet.has(col))

  return [...kept, ...added]
}
