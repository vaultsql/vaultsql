import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Field, Label } from '@/components/catalyst/fieldset'
import { Select } from '@/components/catalyst/select'
import { Textarea } from '@/components/catalyst/textarea'
import { getErrorMessage } from '@/lib/errors'
import { useRequestAccess } from '@/queries/access'

interface RequestAccessDialogProps {
  open: boolean
  onClose: () => void
  databaseId: string
  accountId: string
  accountName: string
  databaseName: string
}

const TIMEOUT_OPTIONS = [
  { value: '1', label: '1 hour' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '12', label: '12 hours (default)' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
  { value: '168', label: '1 week' },
]

export function RequestAccessDialog({
  open,
  onClose,
  databaseId,
  accountId,
  accountName,
  databaseName,
}: RequestAccessDialogProps) {
  const [reason, setReason] = useState('')
  const [timeoutHours, setTimeoutHours] = useState('12')
  const [error, setError] = useState<string | null>(null)

  const requestAccess = useRequestAccess()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      await requestAccess.mutateAsync({
        database_id: databaseId,
        account_id: accountId,
        timeout_hours: parseInt(timeoutHours, 10),
        reason: reason.trim() || undefined,
      })
      handleClose()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const handleClose = () => {
    setReason('')
    setTimeoutHours('12')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Request Access</DialogTitle>
        <DialogDescription>
          Request access to <span className="font-semibold">{accountName}</span> on{' '}
          <span className="font-semibold">{databaseName}</span>. An admin will review your request.
        </DialogDescription>

        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Field>
            <Label>Duration</Label>
            <Select value={timeoutHours} onChange={(e) => setTimeoutHours(e.target.value)}>
              {TIMEOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need access to this account?"
              rows={3}
            />
          </Field>
        </DialogBody>

        <DialogActions>
          <Button type="button" plain onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" color="dark/zinc" disabled={requestAccess.isPending}>
            {requestAccess.isPending ? 'Requesting...' : 'Request Access'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
