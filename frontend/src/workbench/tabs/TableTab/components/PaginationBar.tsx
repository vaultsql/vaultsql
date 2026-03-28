import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTableTabContext } from '../state/TableTabContext'
import { LimitOffsetPopover } from './LimitOffsetPopover'
import { PaginationPopover } from './PaginationPopover'

export function PaginationBar() {
  const { store } = useTableTabContext()
  const rows = store((state) => state.rows)
  const totalRowCount = store((state) => state.totalRowCount)
  const pageSize = store((state) => state.pageSize)
  const currentPage = store((state) => state.currentPage)
  const limitOffset = store((state) => state.limitOffset)
  const setPage = store((state) => state.setPage)

  const [isPaginationOpen, setIsPaginationOpen] = useState(false)
  const [isLimitOpen, setIsLimitOpen] = useState(false)

  // Calculate total pages
  const totalPages = totalRowCount ? Math.ceil(totalRowCount / pageSize) : null
  const hasNextPage = totalPages ? currentPage < totalPages - 1 : rows.length >= pageSize
  const hasPrevPage = currentPage > 0

  // Format row count with comma separators
  const formatNumber = (num: number) => num.toLocaleString()

  // Determine display mode
  const isLimitMode = limitOffset !== null

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      setPage(currentPage + 1)
    }
  }

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-xs">
      {/* Prev/Next buttons */}
      <div className="flex items-center justify-start">
        <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-1 py-0.5 shadow-sm shadow-black/5">
          <Button
            plain
            onClick={handlePrevPage}
            disabled={!hasPrevPage || isLimitMode}
            className="h-6 px-2 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Page indicator - clickable to open popover */}
          {!isLimitMode && (
            <Popover open={isPaginationOpen} onOpenChange={setIsPaginationOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-background/70"
                >
                  {totalPages !== null
                    ? `Page ${currentPage + 1} of ${totalPages}`
                    : `Page ${currentPage + 1}`}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64">
                <PaginationPopover onClose={() => setIsPaginationOpen(false)} />
              </PopoverContent>
            </Popover>
          )}

          {isLimitMode && (
            <span className="rounded-sm px-2 py-0.5 font-medium text-muted-foreground">
              LIMIT {limitOffset.limit} OFFSET {limitOffset.offset}
            </span>
          )}

          <Button
            plain
            onClick={handleNextPage}
            disabled={!hasNextPage || isLimitMode}
            className="h-6 px-2 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Row count display */}
      <span className="justify-self-center rounded-md bg-background/40 px-2 py-0.5 text-muted-foreground shadow-sm shadow-black/5">
        {totalRowCount !== null ? (
          <>
            ~{formatNumber(totalRowCount)} row{totalRowCount !== 1 ? 's' : ''}
          </>
        ) : (
          <>
            {formatNumber(rows.length)} row{rows.length !== 1 ? 's' : ''}
          </>
        )}
      </span>

      {/* LIMIT button */}
      <div className="flex items-center justify-end">
        <Popover open={isLimitOpen} onOpenChange={setIsLimitOpen}>
          <PopoverTrigger asChild>
            <Button
              plain
              className="h-7 px-3 text-xs font-medium text-muted-foreground hover:text-foreground border border-border/60 bg-background/40 shadow-sm shadow-black/5 !items-center"
              aria-label="Set custom LIMIT and OFFSET"
            >
              <span className="inline-flex items-center gap-1">
                LIMIT
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <LimitOffsetPopover onClose={() => setIsLimitOpen(false)} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
