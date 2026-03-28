import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Text } from '@/components/catalyst/text'

interface RemoveMemberDialogProps {
  open: boolean
  memberName?: string
  isPending?: boolean
  errorMessage?: string | null
  onClose: () => void
  onConfirm: () => void
}

export function RemoveMemberDialog({
  open,
  memberName,
  isPending = false,
  errorMessage,
  onClose,
  onConfirm,
}: RemoveMemberDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogTitle>Remove member</DialogTitle>
      <DialogDescription>
        This will deactivate the user's account. They will no longer be able to access this
        workspace.
      </DialogDescription>
      <DialogBody>
        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
          {memberName
            ? `You are about to remove "${memberName}" from the workspace.`
            : 'You are about to remove this member from the workspace.'}
        </Text>
        {errorMessage && (
          <Text className="mt-4 text-sm text-red-600 dark:text-red-400">{errorMessage}</Text>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} disabled={isPending}>
          {isPending ? 'Removing...' : 'Remove member'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
