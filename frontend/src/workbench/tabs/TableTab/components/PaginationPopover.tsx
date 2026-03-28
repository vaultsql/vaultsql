import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Input } from '@/components/catalyst/input'
import { useTableTabContext } from '../state/TableTabContext'

type PaginationPopoverProps = {
  onClose: () => void
}

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500]

export function PaginationPopover({ onClose }: PaginationPopoverProps) {
  const { store } = useTableTabContext()
  const currentPage = store((state) => state.currentPage)
  const pageSize = store((state) => state.pageSize)
  const totalRowCount = store((state) => state.totalRowCount)
  const setPage = store((state) => state.setPage)
  const setPageSize = store((state) => state.setPageSize)

  const totalPages = totalRowCount ? Math.ceil(totalRowCount / pageSize) : null

  const [jumpToPage, setJumpToPage] = useState(String(currentPage + 1))

  const handleApply = () => {
    const pageNum = Number.parseInt(jumpToPage, 10)
    if (!Number.isNaN(pageNum) && pageNum >= 1) {
      // Convert to 0-indexed and clamp to valid range
      const targetPage = Math.max(0, pageNum - 1)
      if (totalPages !== null) {
        setPage(Math.min(targetPage, totalPages - 1))
      } else {
        setPage(targetPage)
      }
    }
    onClose()
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Jump to Page</h3>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            max={totalPages ?? undefined}
            value={jumpToPage}
            onChange={(e) => setJumpToPage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApply()
              }
            }}
            className="flex-1"
            placeholder="Page number"
            disabled={totalPages === null}
          />
          <Button onClick={handleApply} disabled={totalPages === null}>
            Go
          </Button>
        </div>
        {totalPages === null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Page jump unavailable (row count unknown)
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Rows per Page</h3>
        <div className="grid grid-cols-2 gap-2">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Button
              key={size}
              plain
              onClick={() => handlePageSizeChange(size)}
              className={size === pageSize ? 'bg-zinc-950/5 dark:bg-white/10 font-semibold' : ''}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
