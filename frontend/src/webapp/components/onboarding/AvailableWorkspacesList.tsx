import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Field, Label } from '@/components/catalyst/fieldset'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import type { IdentityWorkspace } from '@/queries/identity'

interface AvailableWorkspacesListProps {
  workspaces: IdentityWorkspace[]
  onJoin: (workspaceId: string, userName: string) => void
  isJoining: boolean
  defaultName?: string
}

export function AvailableWorkspacesList({
  workspaces,
  onJoin,
  isJoining,
  defaultName = '',
}: AvailableWorkspacesListProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [userName, setUserName] = useState(defaultName)

  const handleJoinClick = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedWorkspaceId) {
      onJoin(selectedWorkspaceId, userName.trim())
    }
  }

  if (selectedWorkspaceId) {
    const workspace = workspaces.find((w) => w.id === selectedWorkspaceId)
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <Text className="font-semibold">Joining {workspace?.name}</Text>

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

        <Button type="submit" className="w-full" disabled={isJoining || !userName.trim()}>
          {isJoining ? 'Joining...' : 'Join Workspace'}
        </Button>
      </form>
    )
  }

  return (
    <div className="space-y-3">
      {workspaces.map((workspace) => (
        <div
          key={workspace.id}
          className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div>
            <Text className="font-semibold">{workspace.name}</Text>
          </div>
          <Button onClick={() => handleJoinClick(workspace.id)} disabled={isJoining}>
            Join
          </Button>
        </div>
      ))}
    </div>
  )
}
