import { Button } from '@/components/catalyst/button'

type SqlPreviewFooterProps = {
  sqlPreview: string | null
  isValid: boolean
  isSubmitting: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function SqlPreviewFooter({
  sqlPreview,
  isValid,
  isSubmitting,
  onSubmit,
  onCancel,
}: SqlPreviewFooterProps) {
  return (
    <>
      {/* SQL Preview */}
      <div className="shrink-0 border-t border-border px-4 py-3 bg-muted/30">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Preview
        </div>
        <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all bg-background/50 rounded-md p-2 border border-border/50 max-h-32 overflow-y-auto">
          {sqlPreview ?? '-- Enter table name and add columns'}
        </pre>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/20">
        <Button type="button" outline onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" color="indigo" disabled={isSubmitting || !isValid}>
          {isSubmitting ? 'Creating...' : 'Create Table'}
        </Button>
      </div>
    </>
  )
}
