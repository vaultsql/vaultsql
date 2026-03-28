import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { getErrorMessage } from '@/lib/errors'
import { useVaultContext } from '@/lib/vault-context'
import {
  type PendingAccessRequest,
  useApproveAccess,
  useDenyAccess,
  usePendingAccessRequests,
} from '@/queries/access'
import { useUsers } from '@/queries/groups'
import { type UserKey, useActivateKey, usePendingKeys } from '@/queries/keys'
import { EmptyState, LoadingSpinner } from '@/webapp/components'
import { usePageTitle } from '@/webapp/hooks'

export function InboxPage() {
  usePageTitle('Inbox')
  const { data: pendingAccessRequests, isLoading: isLoadingAccess } = usePendingAccessRequests()
  const { data: pendingKeys, isLoading: isLoadingKeys } = usePendingKeys()

  const isLoading = isLoadingAccess || isLoadingKeys
  const hasAccessRequests = pendingAccessRequests && pendingAccessRequests.length > 0
  const hasKeyApprovals = pendingKeys && pendingKeys.length > 0
  const hasAnyPending = hasAccessRequests || hasKeyApprovals

  return (
    <div className="min-h-full">
      {/* Page Header */}
      <div className="px-6 py-8">
        <Heading className="text-2xl">Inbox</Heading>
        <Text className="mt-1 text-zinc-500 dark:text-zinc-400">
          Review and approve access requests and vault key requests from team members.
        </Text>
      </div>

      {/* Content */}
      <div className="px-6 pb-10">
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3 text-zinc-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
                <span>Loading pending approvals...</span>
              </div>
            </div>
          </div>
        ) : !hasAnyPending ? (
          <div className="rounded-lg border border-border bg-card p-8">
            <EmptyState message="No pending approvals. All caught up!" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Access Requests */}
            {hasAccessRequests && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Pending Access Requests
                  </h3>
                  <Text className="mt-1 text-sm">
                    Review and approve database access requests from team members.
                  </Text>
                </div>
                <div className="space-y-3">
                  {pendingAccessRequests.map((request) => (
                    <AccessRequestCard key={request.id} request={request} />
                  ))}
                </div>
              </div>
            )}

            {/* Pending Key Approvals */}
            {hasKeyApprovals && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Pending Key Approvals
                  </h3>
                  <Text className="mt-1 text-sm">
                    Approve vault keys to grant team members access to encrypted credentials.
                  </Text>
                </div>
                <div className="space-y-3">
                  {pendingKeys.map((key) => (
                    <KeyApprovalCard key={key.id} keyRequest={key} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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

function KeyApprovalCard({ keyRequest }: { keyRequest: UserKey }) {
  const { data: users } = useUsers()
  const activateKey = useActivateKey()
  const { passphrase } = useVaultContext()
  const [error, setError] = useState<string | null>(null)

  const user = users?.find((u) => u.id === keyRequest.user_id)
  const userName = user ? user.name : keyRequest.user_email.split('@')[0]

  const handleApprove = async () => {
    // Vault gate ensures passphrase is available on this page
    if (!passphrase) {
      console.error('Passphrase not available - vault gate should have prevented this')
      return
    }

    setError(null)
    try {
      await activateKey.mutateAsync({
        keyId: keyRequest.id,
        passphrase,
      })
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

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
            <span className="font-medium text-foreground">{userName}</span>
            <Text className="text-sm">{keyRequest.user_email}</Text>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Requested{' '}
              {new Date(keyRequest.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            color="emerald"
            onClick={handleApprove}
            disabled={activateKey.isPending}
            className="gap-1"
          >
            <CheckIcon className="h-4 w-4" />
            {activateKey.isPending ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  )
}
