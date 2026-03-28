import clsx from 'clsx'
import { Download, FileCode, FileJson, FileSpreadsheet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Checkbox } from '@/components/catalyst/checkbox'
import { Input } from '@/components/catalyst/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ExportFormat, FilterInput } from '@/workbench/types/database'
import { type ExportScope, useExportQuery } from '../../hooks/useExport'

const EXPORT_FORMATS: { value: ExportFormat; label: string; icon: typeof Download }[] = [
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
  { value: 'json', label: 'JSON', icon: FileJson },
  { value: 'sql', label: 'SQL', icon: FileCode },
]

const EXPORT_SCOPES: { value: ExportScope; label: string }[] = [
  { value: 'all', label: 'All data' },
  { value: 'filtered', label: 'With filters' },
  { value: 'current-page', label: 'Current page' },
  { value: 'custom', label: 'Custom range' },
]

type ExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: string
  table: string
  columnNames: string[]
  activeFilters: FilterInput[]
  currentRowCount: number
}

export function ExportDialog({
  open,
  onOpenChange,
  schema,
  table,
  columnNames,
  activeFilters,
  currentRowCount,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [scope, setScope] = useState<ExportScope>('filtered')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [csvDelimiter, setCsvDelimiter] = useState(',')
  const [sqlTable, setSqlTable] = useState(`${schema}.${table}`)
  const [customLimit, setCustomLimit] = useState<number | undefined>()
  const [customOffset, setCustomOffset] = useState<number | undefined>()

  const { exportData, isExporting, error } = useExportQuery({
    schema,
    table,
    filters: activeFilters,
    currentRowCount,
  })

  // Initialize columns when dialog opens or columns change
  useEffect(() => {
    if (!open) return
    if (columnNames.length === 0) return
    setSelectedColumns((prev) => {
      if (prev.length === 0) return columnNames
      return prev.filter((name) => columnNames.includes(name))
    })
  }, [open, columnNames])

  // Reset SQL table name when schema/table changes
  useEffect(() => {
    setSqlTable(`${schema}.${table}`)
  }, [schema, table])

  const allSelected = selectedColumns.length > 0 && selectedColumns.length === columnNames.length
  const someSelected = selectedColumns.length > 0 && selectedColumns.length < columnNames.length

  const toggleSelectAll = () => {
    setSelectedColumns(allSelected ? [] : columnNames)
  }

  const toggleColumn = (name: string) => {
    setSelectedColumns((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )
  }

  const handleExport = async () => {
    const delimiter = format === 'csv' ? csvDelimiter.trim().slice(0, 1) || undefined : undefined
    const sqlTableName = format === 'sql' ? sqlTable.trim() : undefined

    await exportData({
      format,
      columns: selectedColumns,
      scope,
      customLimit,
      customOffset,
      csvDelimiter: delimiter,
      sqlTable: sqlTableName,
    })

    if (!error) {
      onOpenChange(false)
    }
  }

  const isSqlTableMissing = format === 'sql' && sqlTable.trim().length === 0
  const isCurrentPageEmpty = scope === 'current-page' && currentRowCount === 0
  const canExport =
    columnNames.length > 0 &&
    selectedColumns.length > 0 &&
    !isSqlTableMissing &&
    !isCurrentPageEmpty

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4" />
            Export Table
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Export data from {schema}.{table}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Format */}
          <section>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Format</label>
            <div className="flex gap-2">
              {EXPORT_FORMATS.map((option) => {
                const Icon = option.icon
                const isSelected = format === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormat(option.value)}
                    className={clsx(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition',
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Scope */}
          <section>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              Data scope
              <span className="ml-2 font-normal text-zinc-500">
                ({activeFilters.length} filter{activeFilters.length !== 1 && 's'}, {currentRowCount}{' '}
                loaded)
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_SCOPES.map((option) => {
                const isSelected = scope === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value)}
                    className={clsx(
                      'rounded-md border px-2 py-1 text-xs font-medium transition',
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {scope === 'custom' && (
              <div className="mt-2 flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] text-muted-foreground">Limit</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1000"
                    value={customLimit ?? ''}
                    onChange={(e) =>
                      setCustomLimit(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] text-muted-foreground">Offset</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={customOffset ?? ''}
                    onChange={(e) =>
                      setCustomOffset(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Columns */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Columns ({selectedColumns.length}/{columnNames.length})
              </label>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            {columnNames.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading columns…</p>
            ) : (
              <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-card p-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {columnNames.map((name) => (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedColumns.includes(name)}
                        onChange={() => toggleColumn(name)}
                      />
                      <span className="truncate font-mono text-[11px]">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Format-specific options */}
          {format === 'csv' && (
            <section>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Delimiter
              </label>
              <Input
                value={csvDelimiter}
                onChange={(e) => setCsvDelimiter(e.target.value)}
                maxLength={1}
                className="h-7 w-16 text-center text-xs"
              />
            </section>
          )}

          {format === 'sql' && (
            <section>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Target table name
              </label>
              <Input
                value={sqlTable}
                onChange={(e) => setSqlTable(e.target.value)}
                placeholder="schema.table"
                className="h-7 text-xs"
              />
            </section>
          )}
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="flex-1">
            {error ? (
              <span className="text-xs text-rose-500">{error}</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {selectedColumns.length} column{selectedColumns.length !== 1 && 's'} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport || isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3 w-3" />
              {isExporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
