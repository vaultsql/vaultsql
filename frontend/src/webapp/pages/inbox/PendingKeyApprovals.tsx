import { CheckIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Subheading } from '@/components/catalyst/heading'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { getErrorMessage } from '@/lib/errors'
import { useVaultContext } from '@/lib/vault-context'
import { useUsers } from '@/queries/groups'
import { type UserKey, useActivateKey, usePendingKeys } from '@/queries/keys'

export function PendingKeyApprovals() {
  const { data: pendingKeys, isLoading } = usePendingKeys()
  const { data: users } = useUsers()
  const activateKey = useActivateKey()
  const { passphrase } = useVaultContext()
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async (key: UserKey) => {
    // Vault gate ensures passphrase is available on this page
    if (!passphrase) {
      console.error('Passphrase not available - vault gate should have prevented this')
      return
    }

    setError(null)
    try {
      await activateKey.mutateAsync({
        keyId: key.id,
        passphrase,
      })
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  if (isLoading) {
    return null
  }

  if (!pendingKeys || pendingKeys.length === 0) {
    return null
  }

  return (
    <div className="mt-8">
      <div className="mb-4">
        <Subheading className="text-lg">Pending Key Approvals</Subheading>
        <Text className="mt-1">
          Approve vault keys for team members to grant them access to encrypted credentials.
        </Text>
      </div>
      {error && (
        <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>User</TableHeader>
            <TableHeader>Requested</TableHeader>
            <TableHeader className="text-right">Action</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {pendingKeys.map((key) => {
            const user = users?.find((u) => u.id === key.user_id)
            const userName = user ? user.name : key.user_email.split('@')[0]

            return (
              <TableRow key={key.id}>
                <TableCell>
                  <div className="font-medium">{userName}</div>
                  <div className="text-xs text-zinc-500">{key.user_email}</div>
                </TableCell>
                <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    color="emerald"
                    onClick={() => handleApprove(key)}
                    disabled={activateKey.isPending}
                    className="gap-1"
                  >
                    <CheckIcon className="h-4 w-4" />
                    {activateKey.isPending ? 'Approving...' : 'Approve'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
