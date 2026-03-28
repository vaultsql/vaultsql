import { useCallback, useState } from 'react'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import type { ExportFormat, ExportRunOptions, FilterInput } from '@/workbench/types/database'

export type ExportScope = 'all' | 'filtered' | 'current-page' | 'custom'

export type ExportOptions = {
  format: ExportFormat
  columns: string[]
  scope: ExportScope
  customLimit?: number
  customOffset?: number
  csvDelimiter?: string
  sqlTable?: string
}

type ExportContext = {
  schema: string
  table: string
  filters: FilterInput[]
  currentRowCount: number
}

function normalizePositiveInt(value?: number): number | undefined {
  if (value === undefined || value === null) return undefined
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : undefined
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function useExportQuery({ schema, table, filters, currentRowCount }: ExportContext) {
  const { db, backend } = useWorkbench()
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportData = useCallback(
    async (options: ExportOptions) => {
      setIsExporting(true)
      setError(null)

      try {
        const shouldApplyFilters = options.scope !== 'all'
        const resolvedFilters = shouldApplyFilters ? filters : []

        const limit =
          options.scope === 'current-page'
            ? normalizePositiveInt(currentRowCount)
            : options.scope === 'custom'
              ? normalizePositiveInt(options.customLimit)
              : undefined

        const offset =
          options.scope === 'current-page'
            ? 0
            : options.scope === 'custom'
              ? normalizePositiveInt(options.customOffset)
              : undefined

        const { sql } = db.buildExportQuery({
          schema,
          table,
          columns: options.columns,
          filters: resolvedFilters,
          limit,
          offset,
        })

        const exportOptions: ExportRunOptions = {
          format: options.format,
          columns: options.columns,
          csvDelimiter: options.csvDelimiter,
          sqlTable: options.sqlTable,
        }

        const result = await backend.query.exportQuery(sql, exportOptions, {
          actor: 'application',
          operation: 'export_query',
        })

        downloadBlob(result.filename, result.blob)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to export data')
      } finally {
        setIsExporting(false)
      }
    },
    [backend.query, currentRowCount, db, filters, schema, table],
  )

  return { exportData, isExporting, error }
}
