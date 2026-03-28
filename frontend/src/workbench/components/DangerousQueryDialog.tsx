import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Text } from '@/components/catalyst/text'

type DangerousQueryDialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description: string
  operation: string
  targetName: string
  sqlPreview: string
  confirmLabel?: string
  onConfirm: () => void
  error?: string | null
  isSubmitting?: boolean
}

export function DangerousQueryDialog({
  open,
  onClose,
  title,
  description,
  operation,
  targetName,
  sqlPreview,
  confirmLabel,
  onConfirm,
  error,
  isSubmitting = false,
}: DangerousQueryDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <DialogBody className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded bg-red-500/20 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-red-400">
            {operation}
          </span>
          <Text className="font-mono text-sm">{targetName}</Text>
        </div>

        {/* SQL Preview */}
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            SQL to Execute
          </div>
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
            {sqlPreview}
          </pre>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-950/30 border border-red-900/50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400 break-all">{error}</p>
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? 'Executing...' : (confirmLabel ?? operation)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
