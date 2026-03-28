import { ArrowPathIcon } from '@heroicons/react/20/solid'
import { useEffect, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/catalyst/dialog'
import { Description, Field, FieldGroup, Fieldset, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import type { WorkspaceInvitation } from '@/queries/workspace'
import { useWorkspaceInvite } from '@/queries/workspace'
import { getAppUrl } from '@/lib/app-url'

interface InviteMembersDialogProps {
  open: boolean
  onClose: () => void
}

export function InviteMembersDialog({ open, onClose }: InviteMembersDialogProps) {
  const generateInvite = useWorkspaceInvite(false)
  const regenerateInvite = useWorkspaceInvite(true)
  const [inviteUrl, setInviteUrl] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [inviteData, setInviteData] = useState<WorkspaceInvitation | null>(null)

  useEffect(() => {
    if (!open) {
      setInviteUrl('')
      setHasLoaded(false)
      setInviteData(null)
      return
    }

    if (hasLoaded) return

    const loadInvite = async () => {
      try {
        const result = await generateInvite.mutateAsync()
        setInviteData(result)
        setInviteUrl(`${getAppUrl()}/invite/${result.token}`)
        setHasLoaded(true)
      } catch {
        // Error handled via mutation state.
      }
    }

    loadInvite()
  }, [open, hasLoaded, generateInvite.mutateAsync])

  const inviteLinkError =
    generateInvite.error instanceof Error
      ? generateInvite.error.message
      : regenerateInvite.error instanceof Error
        ? regenerateInvite.error.message
        : null

  const handleRegenerateInviteLink = async () => {
    try {
      const result = await regenerateInvite.mutateAsync()
      setInviteData(result)
      setInviteUrl(`${getAppUrl()}/invite/${result.token}`)
    } catch {
      // Error handled via mutation state.
    }
  }

  const formatExpiration = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return 'Never'
    const date = new Date(expiresAt)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Invite members</DialogTitle>
      <DialogDescription>
        Generate a shareable link to invite teammates to your workspace.
      </DialogDescription>
      <DialogBody>
        <Fieldset>
          <FieldGroup>
            <Field>
              <Label>Invite link</Label>
              <Description>Share this link with teammates to join your workspace.</Description>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteUrl || 'Loading invite link...'}
                  className="flex-1 text-sm text-zinc-600 dark:text-zinc-300"
                />
                <Button
                  outline
                  onClick={handleRegenerateInviteLink}
                  disabled={regenerateInvite.isPending || !inviteUrl}
                >
                  <ArrowPathIcon data-slot="icon" />
                  {regenerateInvite.isPending ? 'Regenerating...' : 'Regenerate'}
                </Button>
              </div>
              {inviteLinkError && (
                <Text className="mt-2 text-sm text-red-600">{inviteLinkError}</Text>
              )}
              {inviteData && (
                <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {inviteData.expires_at && (
                    <Text>
                      <strong>Expires:</strong> {formatExpiration(inviteData.expires_at)}
                    </Text>
                  )}
                  {inviteData.max_uses !== null && inviteData.max_uses !== undefined && (
                    <Text>
                      <strong>Usage:</strong> {inviteData.use_count} / {inviteData.max_uses}
                    </Text>
                  )}
                  {!inviteData.expires_at && inviteData.max_uses === null && (
                    <Text>This invitation never expires and has no usage limit.</Text>
                  )}
                </div>
              )}
            </Field>
          </FieldGroup>
        </Fieldset>
      </DialogBody>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
