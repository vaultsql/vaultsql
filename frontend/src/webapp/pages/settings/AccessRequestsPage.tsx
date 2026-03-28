import { Badge } from '@/components/catalyst/badge'
import { Divider } from '@/components/catalyst/divider'
import { Heading } from '@/components/catalyst/heading'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { type AccessRequestHistory, useAccessRequestHistory } from '@/queries/access'
import { usePageTitle } from '@/webapp/hooks'

export function AccessRequestsPage() {
  usePageTitle('Access Requests')
  const { data: requests, isLoading, error } = useAccessRequestHistory()

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge color="amber">Pending</Badge>
      case 'approved':
        return <Badge color="emerald">Approved</Badge>
      case 'denied':
        return <Badge color="red">Denied</Badge>
      case 'revoked':
        return <Badge color="zinc">Revoked</Badge>
      case 'expired':
        return <Badge color="zinc">Expired</Badge>
      default:
        return <Badge color="zinc">{status}</Badge>
    }
  }

  const getAccessLevelBadge = (level: string) => {
    switch (level) {
      case 'readonly':
        return <Badge color="sky">Read Only</Badge>
      case 'write':
        return <Badge color="orange">Write</Badge>
      case 'admin':
        return <Badge color="purple">Admin</Badge>
      default:
        return <Badge color="zinc">{level}</Badge>
    }
  }

  const getResolvedInfo = (request: AccessRequestHistory) => {
    if (request.granted_at && request.granted_by_name) {
      return (
        <div className="text-sm">
          <div className="text-zinc-600 dark:text-zinc-400">
            Approved by {request.granted_by_name}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            {formatTimestamp(request.granted_at)}
          </div>
        </div>
      )
    }
    if (request.denied_at && request.denied_by_name) {
      return (
        <div className="text-sm">
          <div className="text-zinc-600 dark:text-zinc-400">Denied by {request.denied_by_name}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            {formatTimestamp(request.denied_at)}
          </div>
        </div>
      )
    }
    if (request.revoked_at && request.revoked_by_name) {
      return (
        <div className="text-sm">
          <div className="text-zinc-600 dark:text-zinc-400">
            Revoked by {request.revoked_by_name}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            {formatTimestamp(request.revoked_at)}
          </div>
        </div>
      )
    }
    return <Text className="text-sm text-zinc-500 dark:text-zinc-500">-</Text>
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl">
        <Heading>Access Requests</Heading>
        <Divider className="my-6 mt-4" />
        <Text>Loading access request history...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl">
        <Heading>Access Requests</Heading>
        <Divider className="my-6 mt-4" />
        <Text className="text-red-600 dark:text-red-400">
          Failed to load access requests. Please try again.
        </Text>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <Heading>Access Requests</Heading>
      <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
        View the history of access requests made by team members. Showing the last 50 requests.
      </Text>
      <Divider className="my-6 mt-4" />

      {!requests || requests.length === 0 ? (
        <div className="py-8 text-center">
          <Text className="text-zinc-500 dark:text-zinc-400">No access requests found.</Text>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Status</TableHeader>
                <TableHeader>Requester</TableHeader>
                <TableHeader>Database</TableHeader>
                <TableHeader>Account</TableHeader>
                <TableHeader>Reason</TableHeader>
                <TableHeader>Requested</TableHeader>
                <TableHeader>Resolution</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-zinc-950 dark:text-white">
                        {request.user_name}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        {request.user_email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-zinc-950 dark:text-white">
                        {request.database_name}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        {request.database_type}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-zinc-950 dark:text-white">
                        {request.account_name}
                      </div>
                      {getAccessLevelBadge(request.access_level)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {request.reason ? (
                      <div className="max-w-xs truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {request.reason}
                      </div>
                    ) : (
                      <Text className="text-sm text-zinc-500 dark:text-zinc-500">-</Text>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {formatTimestamp(request.requested_at)}
                    </div>
                  </TableCell>
                  <TableCell>{getResolvedInfo(request)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
