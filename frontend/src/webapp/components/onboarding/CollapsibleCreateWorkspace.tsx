import { useState } from 'react'
import { Divider } from '@/components/catalyst/divider'
import { Text } from '@/components/catalyst/text'
import { CreateWorkspaceForm } from './CreateWorkspaceForm'

interface CollapsibleCreateWorkspaceProps {
  onSuccess: (token: string) => void
  onError?: (error: string) => void
  defaultName?: string
}

export function CollapsibleCreateWorkspace({
  onSuccess,
  onError,
  defaultName = '',
}: CollapsibleCreateWorkspaceProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <Divider soft />

      <div className="space-y-6">
        <div>
          <Text>
            Or{' '}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="font-semibold text-zinc-950 underline decoration-zinc-950/50 transition hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:hover:decoration-white"
            >
              create a new workspace
            </button>
          </Text>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              Get started by creating a new workspace for your team.
            </Text>
            <CreateWorkspaceForm
              onSuccess={onSuccess}
              onError={onError}
              defaultName={defaultName}
            />
          </div>
        )}
      </div>
    </>
  )
}
