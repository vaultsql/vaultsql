import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import type { ForeignKeyInfo } from '@/workbench/types/database'
import { openTableTab } from '../../../../controllers/openTableTab'
import { formatValue } from './formatters'

export type FkExpandState = {
  row: Record<string, unknown> | null
  loading: boolean
  error: string | null
}

type FkWellProps = {
  fk: ForeignKeyInfo
  state: FkExpandState
}

/**
 * Expansion well that displays the referenced row data when a foreign key is expanded.
 * Shows loading state, error state, or the row data with an "Open Table" button.
 */
export function FkWell({ fk, state }: FkWellProps) {
  const { loading, error, row } = state

  const handleOpenTable = () => {
    if (!row) return
    openTableTab({
      schema: fk.refSchema,
      table: fk.refTable,
    })
  }

  return (
    <tr className="bg-muted/30">
      <td colSpan={2} className="px-3 py-3">
        <div className="border-l-2 border-blue-400/50 pl-4">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-medium text-muted-foreground truncate max-w-[200px]"
              title={`${fk.refSchema}.${fk.refTable}`}
            >
              {fk.refSchema}.{fk.refTable}
            </span>
            {row && (
              <Button plain onClick={handleOpenTable}>
                <ExternalLink className="h-3 w-3" />
                Open Table
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : error ? (
            <div className="text-xs text-rose-500 py-2">{error}</div>
          ) : row ? (
            <div className="space-y-1.5">
              {Object.entries(row)
                .slice(0, 10)
                .map(([colName, colValue]) => {
                  const formatted = formatValue(colValue)
                  return (
                    <div key={colName} className="flex gap-2 text-xs">
                      <span
                        className="text-muted-foreground font-medium min-w-[80px] truncate"
                        title={colName}
                      >
                        {colName}:
                      </span>
                      <span
                        className={`font-mono break-all ${formatted.isNull ? 'text-muted-foreground' : 'text-foreground'}`}
                      >
                        {formatted.display}
                      </span>
                    </div>
                  )
                })}
              {Object.keys(row).length > 10 && (
                <div className="text-xs text-muted-foreground italic pt-1">
                  ... and {Object.keys(row).length - 10} more columns
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground py-2">No matching row found</div>
          )}
        </div>
      </td>
    </tr>
  )
}
