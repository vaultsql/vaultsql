import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Input } from '@/components/catalyst/input'
import { useTableTabContext } from '../state/TableTabContext'

type LimitOffsetPopoverProps = {
  onClose: () => void
}

const MAX_LIMIT = 500

export function LimitOffsetPopover({ onClose }: LimitOffsetPopoverProps) {
  const { store } = useTableTabContext()
  const limitOffset = store((state) => state.limitOffset)
  const setLimitOffset = store((state) => state.setLimitOffset)

  const [limit, setLimit] = useState(String(limitOffset?.limit ?? 200))
  const [offset, setOffset] = useState(String(limitOffset?.offset ?? 0))

  const handleApply = () => {
    const limitNum = Number.parseInt(limit, 10)
    const offsetNum = Number.parseInt(offset, 10)

    if (!Number.isNaN(limitNum) && !Number.isNaN(offsetNum) && limitNum > 0 && offsetNum >= 0) {
      setLimitOffset({
        limit: Math.min(limitNum, MAX_LIMIT),
        offset: offsetNum,
      })
    }
    onClose()
  }

  const handleClear = () => {
    setLimitOffset(null)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Custom LIMIT/OFFSET</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Bypass pagination and specify exact LIMIT and OFFSET values. Maximum limit is {MAX_LIMIT}.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="limit-input" className="block text-xs font-medium text-foreground mb-1">
            LIMIT
          </label>
          <Input
            id="limit-input"
            type="number"
            min={1}
            max={MAX_LIMIT}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApply()
              }
            }}
            placeholder="Number of rows"
          />
        </div>

        <div>
          <label htmlFor="offset-input" className="block text-xs font-medium text-foreground mb-1">
            OFFSET
          </label>
          <Input
            id="offset-input"
            type="number"
            min={0}
            value={offset}
            onChange={(e) => setOffset(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApply()
              }
            }}
            placeholder="Starting row"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1">
          Apply
        </Button>
        {limitOffset && (
          <Button plain onClick={handleClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
