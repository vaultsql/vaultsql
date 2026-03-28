import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GridColumnDef } from './types'

type ColumnSizingState = Record<string, number>

const STORAGE_PREFIX = 'column-size:'
const MIN_COLUMN_WIDTH = 40
const MAX_AUTO_FIT_WIDTH = 500
const DEFAULT_COLUMN_WIDTH = 120

type ResizeState = {
  columnId: string
  startX: number
  startWidth: number
  minWidth?: number
  maxWidth?: number
}

export function useColumnSizing<T>({
  columns,
  storageKey,
}: {
  columns: GridColumnDef<T>[]
  storageKey: string | null
}) {
  const [widths, setWidths] = useState<ColumnSizingState>(() => {
    const defaults: ColumnSizingState = {}
    for (const col of columns) {
      if (typeof col.width === 'number') defaults[col.id] = col.width
    }
    if (!storageKey) return defaults

    const stored = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`)
    if (!stored) return defaults
    try {
      const parsed = JSON.parse(stored) as ColumnSizingState
      return { ...defaults, ...parsed }
    } catch {
      return defaults
    }
  })

  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  useEffect(() => {
    // Reconcile widths when columns change
    setWidths((current) => {
      const next: ColumnSizingState = {}
      for (const col of columns) {
        if (current[col.id]) {
          next[col.id] = current[col.id]
        } else if (typeof col.width === 'number') {
          next[col.id] = col.width
        }
      }
      return next
    })
  }, [columns])

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(widths))
  }, [storageKey, widths])

  const getWidth = useCallback((columnId: string) => widths[columnId], [widths])

  const setColumnWidth = useCallback((columnId: string, width: number) => {
    const clampedWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_AUTO_FIT_WIDTH, Math.round(width)))
    setWidths((current) => ({
      ...current,
      [columnId]: clampedWidth,
    }))
  }, [])

  const startResize = useCallback(
    (column: GridColumnDef<T>, startX: number) => {
      resizeRef.current = {
        columnId: column.id,
        startX,
        startWidth: widths[column.id] ?? column.width ?? DEFAULT_COLUMN_WIDTH,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
      }
      setResizingColumnId(column.id)
      // Apply body styles for better UX during resize
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [widths],
  )

  const applyResize = useCallback((clientX: number) => {
    const state = resizeRef.current
    if (!state) return

    const delta = clientX - state.startX
    let nextWidth = state.startWidth + delta
    if (typeof state.minWidth === 'number') {
      nextWidth = Math.max(state.minWidth, nextWidth)
    }
    if (typeof state.maxWidth === 'number') {
      nextWidth = Math.min(state.maxWidth, nextWidth)
    }

    setWidths((current) => ({
      ...current,
      [state.columnId]: Math.max(MIN_COLUMN_WIDTH, Math.round(nextWidth)),
    }))
  }, [])

  const stopResize = useCallback(() => {
    resizeRef.current = null
    setResizingColumnId(null)
    // Reset body styles
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!resizeRef.current) return
      applyResize(event.clientX)
    }
    const onPointerUp = () => {
      if (!resizeRef.current) return
      stopResize()
    }
    // Handle lost pointer capture (e.g., if user presses Escape)
    const onLostPointerCapture = () => {
      if (!resizeRef.current) return
      stopResize()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('lostpointercapture', onLostPointerCapture)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('lostpointercapture', onLostPointerCapture)
    }
  }, [applyResize, stopResize])

  const columnStyles = useMemo(() => {
    return columns.map((column) => ({
      id: column.id,
      width: widths[column.id],
    }))
  }, [columns, widths])

  const isResizing = resizingColumnId !== null

  return {
    getWidth,
    setColumnWidth,
    startResize,
    columnStyles,
    isResizing,
    resizingColumnId,
  }
}
