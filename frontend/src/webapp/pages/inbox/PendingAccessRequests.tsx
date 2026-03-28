import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { Subheading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { getErrorMessage } from '@/lib/errors'
import {
  type PendingAccessRequest,
  useApproveAccess,
  useDenyAccess,
  usePendingAccessRequests,
} from '@/queries/access'

export function PendingAccessRequests() {
  const { data: pendingRequests, isLoading } = usePendingAccessRequests()

  if (isLoading) {
    return null
  }

  if (!pendingRequests || pendingRequests.length === 0) {
    return null
  }

  return (
    <div className="mt-8">
      <div className="mb-4">
        <Subheading className="text-lg">Pending Access Requests</Subheading>
        <Text className="mt-1">Review and approve access requests from team members.</Text>
      </div>
      <div className="space-y-3">
        {pendingRequests.map((request) => (
          <AccessRequestCard key={request.id} request={request} />
        ))}
      </div>
    </div>
  )
}

function AccessRequestCard({ request }: { request: PendingAccessRequest }) {
  const approveAccess = useApproveAccess()
  const denyAccess = useDenyAccess()
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setError(null)
    try {
      await approveAccess.mutateAsync(request.id)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const handleDeny = async () => {
    setError(null)
    try {
      await denyAccess.mutateAsync(request.id)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const isPending = approveAccess.isPending || denyAccess.isPending

  return (
    <div className="rounded-lg border border-border bg-accent/30 p-4">
      {error && (
        <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{request.user_name}</span>
            <Text className="text-sm">{request.user_email}</Text>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge color="zinc">{request.database_name}</Badge>
            <span className="text-muted-foreground">/</span>
            <Badge color="sky">{request.account_name}</Badge>
          </div>
          {request.reason && (
            <div className="mt-2">
              <Text className="text-sm italic">"{request.reason}"</Text>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Requested{' '}
              {new Date(request.requested_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {request.granted_until && (
              <span>
                Access until{' '}
                {new Date(request.granted_until).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            outline
            onClick={handleDeny}
            disabled={isPending}
            className="gap-1 text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <XMarkIcon className="h-4 w-4" />
            Deny
          </Button>
          <Button color="emerald" onClick={handleApprove} disabled={isPending} className="gap-1">
            <CheckIcon className="h-4 w-4" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  )
}
