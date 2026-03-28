import { ChevronRightIcon, ClockIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { HistoryItem, QueryActor } from '@/workbench/types/database'
import { useWorkbench } from '../context/useWorkbench'

type ActorFilter = 'all' | QueryActor

const ACTOR_FILTERS: Array<{ id: ActorFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'application', label: 'Application' },
  { id: 'custom', label: 'Worksheet' },
  { id: 'user', label: 'User' },
]

function getActorLabel(actor?: QueryActor) {
  switch (actor) {
    case 'application':
      return 'Application'
    case 'custom':
      return 'Worksheet'
    case 'user':
      return 'User'
    default:
      return 'Application'
  }
}

function HistoryItemRow({ item }: { item: HistoryItem }) {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => setExpanded(!expanded)

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="flex-shrink-0">
            <ChevronRightIcon
              className={`w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            {item.error ? (
              <span className="flex-shrink-0 inline-flex items-center rounded-md bg-red-400/10 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-400/20">
                Error
              </span>
            ) : (
              <span className="flex-shrink-0 inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-500 ring-1 ring-inset ring-emerald-500/20">
                Success
              </span>
            )}
            <span className="flex-shrink-0 inline-flex items-center rounded-md bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/40">
              {getActorLabel(item.actor)}
            </span>
            <div className="truncate font-mono text-sm text-foreground group-hover:text-foreground transition-colors">
              {item.query}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {item.durationMs.toFixed(1)}ms
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(item.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 bg-card/50">
          <div className="pl-8 pt-2 space-y-3">
            <div className="rounded bg-background border border-border p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-foreground leading-relaxed">{item.query}</pre>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">Rows affected</div>
                <div className="font-mono text-foreground">
                  {item.rowCount !== undefined ? item.rowCount.toLocaleString() : '-'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Duration</div>
                <div className="font-mono text-foreground">{item.durationMs.toFixed(3)}ms</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Timestamp</div>
                <div className="font-mono text-foreground">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">ID</div>
                <div className="font-mono text-muted-foreground select-all">{item.id}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Actor</div>
                <div className="font-mono text-foreground">{getActorLabel(item.actor)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Operation</div>
                <div className="font-mono text-foreground">{item.operation ?? '-'}</div>
              </div>
            </div>

            {item.error && (
              <div className="rounded bg-red-950/20 border border-red-900/50 p-3">
                <div className="text-xs font-medium text-red-400 mb-1">Error Message</div>
                <div className="text-xs font-mono text-red-300">{item.error}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type HistoryModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HistoryModal({ open, onOpenChange }: HistoryModalProps) {
  const { history, clearHistory } = useWorkbench()
  const [actorFilter, setActorFilter] = useState<ActorFilter>('all')

  const filteredHistory = useMemo(() => {
    if (actorFilter === 'all') {
      return history
    }
    return history.filter((item) => item.actor === actorFilter)
  }, [history, actorFilter])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Query History</DialogTitle>
            <Button
              plain
              onClick={clearHistory}
              disabled={history.length === 0}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
            >
              Clear History
            </Button>
          </div>
          <DialogDescription className="sr-only">
            View your query execution history
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground font-medium">Type</span>
          <div className="flex flex-wrap items-center gap-2">
            {ACTOR_FILTERS.map((filter) => {
              const isActive = actorFilter === filter.id
              return (
                <Button
                  key={filter.id}
                  outline
                  compact
                  data-active={isActive ? '' : undefined}
                  onClick={() => setActorFilter(filter.id)}
                >
                  {filter.label}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {history.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <ClockIcon className="w-10 h-10 opacity-20" />
              <p className="text-sm">No queries executed yet.</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <ClockIcon className="w-10 h-10 opacity-20" />
              <p className="text-sm">No queries match this filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredHistory.map((item) => (
                <HistoryItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
