import { AlertTriangleIcon, CheckIcon, ListIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CommitResult, HydratedMutation } from '../lib/mutations'

type MutationPreviewModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Hydrated mutations with SQL */
  hydratedQueries: HydratedMutation[]
  /** Callback to remove a mutation by id */
  onRemove: (id: string) => void
  /** Callback to clear all mutations */
  onClear: () => void
  /** Callback to commit all mutations */
  onCommit: () => Promise<CommitResult>
}

export function MutationPreviewModal({
  open,
  onOpenChange,
  hydratedQueries,
  onRemove,
  onClear,
  onCommit,
}: MutationPreviewModalProps) {
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)

  const isEmpty = hydratedQueries.length === 0

  const handleCommit = useCallback(async () => {
    setIsCommitting(true)
    setCommitResult(null)

    try {
      const result = await onCommit()
      setCommitResult(result)

      if (result.success) {
        setTimeout(() => {
          onOpenChange(false)
          setCommitResult(null)
        }, 1000)
      }
    } finally {
      setIsCommitting(false)
    }
  }, [onCommit, onOpenChange])

  const handleClear = useCallback(() => {
    onClear()
    setCommitResult(null)
  }, [onClear])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setCommitResult(null)
      }
      onOpenChange(newOpen)
    },
    [onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Pending Changes
              {!isEmpty && (
                <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-400">
                  {hydratedQueries.length}
                </span>
              )}
            </DialogTitle>
            <Button
              plain
              compact
              onClick={handleClear}
              disabled={isEmpty || isCommitting}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
            >
              Clear All
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Review and commit pending database changes
          </DialogDescription>
        </DialogHeader>

        {/* Error banner */}
        {commitResult && !commitResult.success && (
          <div className="px-6 py-3 bg-red-950/30 border-b border-red-900/50 flex items-start gap-3">
            <AlertTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium text-red-400">
                Failed at query {(commitResult.failedIndex ?? 0) + 1}
              </p>
              <p className="text-xs text-red-300/80 font-mono break-all">{commitResult.error}</p>
            </div>
          </div>
        )}

        {/* Success banner */}
        {commitResult?.success && (
          <div className="px-6 py-3 bg-emerald-950/30 border-b border-emerald-900/50 flex items-center gap-3">
            <CheckIcon className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-400">
              Committed {commitResult.committed} query(s)
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {isEmpty ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <ListIcon className="w-10 h-10 opacity-20" />
              <p className="text-sm">No pending changes.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {hydratedQueries.map((mutation, index) => (
                <div
                  key={mutation.entry.id}
                  className="group rounded border border-border bg-background overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                    <span className="text-xs font-mono text-muted-foreground">
                      {index + 1}. {mutation.entry.target}
                    </span>
                    <Button
                      plain
                      compact
                      title="Remove"
                      onClick={() => onRemove(mutation.entry.id)}
                      disabled={isCommitting}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2Icon data-slot="icon" />
                    </Button>
                  </div>
                  <pre className="p-3 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap overflow-x-auto">
                    {mutation.sql};
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button outline onClick={() => handleOpenChange(false)} disabled={isCommitting}>
            Cancel
          </Button>
          <Button
            color="indigo"
            onClick={handleCommit}
            disabled={isEmpty || isCommitting || commitResult?.success}
          >
            {isCommitting
              ? 'Committing...'
              : `Commit ${hydratedQueries.length} Change${hydratedQueries.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
