import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Text } from '@/components/catalyst/text'

interface DeleteGroupDialogProps {
  open: boolean
  groupName?: string
  isPending?: boolean
  errorMessage?: string | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteGroupDialog({
  open,
  groupName,
  isPending = false,
  errorMessage,
  onClose,
  onConfirm,
}: DeleteGroupDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogTitle>Delete group</DialogTitle>
      <DialogDescription>
        This removes the group and its memberships. Members stay in the workspace.
      </DialogDescription>
      <DialogBody>
        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
          {groupName
            ? `You are about to delete "${groupName}".`
            : 'You are about to delete this group.'}
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
          {isPending ? 'Deleting...' : 'Delete group'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
