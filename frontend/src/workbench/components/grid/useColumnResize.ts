import { useCallback, useEffect, useRef, useState } from 'react'
import type { ColumnResizeState, ColumnWidths } from './types'

const STORAGE_PREFIX = 'column-widths:'
const DEFAULT_MIN_WIDTH = 50
const DEFAULT_WIDTH = 150

type UseColumnResizeOptions = {
  /** Column keys */
  columnKeys: string[]
  /** Storage key for persisting widths (optional) */
  storageKey?: string | null
  /** Default minimum width for columns */
  minWidth?: number
  /** Default width for columns without explicit width */
  defaultWidth?: number
  /** Initial widths from column definitions */
  initialWidths?: Record<string, number | undefined>
}

/**
 * Hook for managing column resize functionality.
 * Supports drag-to-resize and persists widths to localStorage.
 */
export function useColumnResize({
  columnKeys,
  storageKey,
  minWidth = DEFAULT_MIN_WIDTH,
  defaultWidth = DEFAULT_WIDTH,
  initialWidths = {},
}: UseColumnResizeOptions): ColumnResizeState {
  // Load initial widths from storage or use defaults
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    if (storageKey) {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ColumnWidths
          if (typeof parsed === 'object' && parsed !== null) {
            return parsed
          }
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }

    // Build default widths from initialWidths
    const defaults: ColumnWidths = {}
    for (const key of columnKeys) {
      if (initialWidths[key] !== undefined) {
        defaults[key] = initialWidths[key]
      }
    }
    return defaults
  })

  // Track resize state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Persist to localStorage when widths change
  useEffect(() => {
    if (!storageKey) return

    const hasCustomWidths = Object.keys(columnWidths).length > 0
    if (hasCustomWidths) {
      localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(columnWidths))
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`)
    }
  }, [storageKey, columnWidths])

  const getColumnWidth = useCallback(
    (columnKey: string): number | undefined => {
      return columnWidths[columnKey]
    },
    [columnWidths],
  )

  const startResize = useCallback(
    (columnKey: string, startX: number) => {
      const currentWidth = columnWidths[columnKey] ?? defaultWidth
      resizeStartRef.current = { startX, startWidth: currentWidth }
      setResizingColumn(columnKey)
    },
    [columnWidths, defaultWidth],
  )

  // Handle mouse move during resize
  useEffect(() => {
    if (!resizingColumn) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current || !resizingColumn) return

      const { startX, startWidth } = resizeStartRef.current
      const deltaX = e.clientX - startX
      const newWidth = Math.max(minWidth, startWidth + deltaX)

      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
      resizeStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Add cursor style to body during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingColumn, minWidth])

  return {
    columnWidths,
    getColumnWidth,
    startResize,
    isResizing: resizingColumn !== null,
    resizingColumn,
  }
}
