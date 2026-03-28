import { useState } from 'react'
import { AuthLayout } from '@/components/catalyst/auth-layout'
import { Button } from '@/components/catalyst/button'
import { ErrorMessage, Field, Label } from '@/components/catalyst/fieldset'
import { Heading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { useIdentityWorkspacesWithInvite, useJoinWorkspace } from '@/queries/identity'
import { OnboardingHeader } from './OnboardingHeader'

interface WorkspaceInviteViewProps {
  inviteCode: string
  onLogout: () => void
  onSuccess: (token: string) => void
  defaultName?: string
}

export function WorkspaceInviteView({
  inviteCode,
  onLogout,
  onSuccess,
  defaultName = '',
}: WorkspaceInviteViewProps) {
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState(defaultName)
  const invitedWorkspaces = useIdentityWorkspacesWithInvite({ inviteCode })
  const joinWorkspace = useJoinWorkspace()

  const handleJoinWorkspace = async (workspaceId: string) => {
    setError(null)
    try {
      const data = await joinWorkspace.mutateAsync({
        workspaceId,
        inviteCode,
        userName: userName.trim(),
      })

      onSuccess(data.token)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'There was an error joining the workspace. Please try again.',
      )
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userName.trim() || joinWorkspace.isPending) return
    handleJoinWorkspace(workspace.id)
  }

  if (invitedWorkspaces.isLoading) {
    return (
      <AuthLayout panelClassName="max-w-2xl">
        <div className="w-full space-y-6">
          <div className="space-y-2">
            <Heading>Loading invitation...</Heading>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (invitedWorkspaces.isError || !invitedWorkspaces.data || invitedWorkspaces.data.length === 0) {
    return (
      <AuthLayout panelClassName="max-w-2xl">
        <div className="w-full space-y-6">
          <div className="space-y-2">
            <Heading>Invalid Invitation</Heading>
            <Text className="text-red-600 dark:text-red-400">
              This invite link is invalid or has expired.
            </Text>
          </div>
        </div>
      </AuthLayout>
    )
  }

  const workspace = invitedWorkspaces.data[0]

  return (
    <AuthLayout panelClassName="max-w-2xl">
      <div className="w-full space-y-6">
        <OnboardingHeader
          title="Join Workspace"
          description={`You have been invited to join ${workspace.name}`}
          onLogout={onLogout}
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Field>
            <Label>Your Name</Label>
            <Input
              name="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Button
            type="submit"
            className="w-full"
            disabled={joinWorkspace.isPending || !userName.trim()}
          >
            {joinWorkspace.isPending ? 'Joining...' : 'Accept Invite'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
