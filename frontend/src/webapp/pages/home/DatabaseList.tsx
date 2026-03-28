import { CircleStackIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'
import { Button } from '@/components/catalyst/button'
import { Text } from '@/components/catalyst/text'
import { useVaultContext } from '@/lib/vault-context'
import type { Access } from '@/queries/access'
import { useSetupDemoDatabases, type Database } from '@/queries/databases'
import { useIsAdmin } from '@/queries/user'
import { EmptyState } from '@/webapp/components'
import { DatabaseCard } from './DatabaseCard'
import type { AccessFilter } from './types'

interface DatabaseListProps {
  databases: Database[]
  filteredDatabases: Database[]
  accessByAccount: Map<string, Access>
  pendingByAccount: Map<string, Access>
  searchQuery: string
  accessFilter: AccessFilter
}

export function DatabaseList({
  databases,
  filteredDatabases,
  accessByAccount,
  pendingByAccount,
  searchQuery,
  accessFilter,
}: DatabaseListProps) {
  const isAdmin = useIsAdmin()
  const { isVaultMode, passphrase } = useVaultContext()
  const setupDemo = useSetupDemoDatabases()

  const handleSetupDemo = () => {
    // In vault mode, pass the passphrase; otherwise pass undefined
    const passphraseToSend = isVaultMode ? passphrase : undefined
    setupDemo.mutate(passphraseToSend, {
      onSuccess: (data) => {
        if (data.databases.length > 0) {
          toast.success(`Created ${data.databases.length} demo database(s)`)
        } else {
          toast.info('Demo databases already exist')
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to set up demo databases')
      },
    })
  }

  if (databases.length === 0) {
    if (isAdmin) {
      return (
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-md">
              <div className="mb-4 rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
                <CircleStackIcon className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                No Databases Yet
              </h3>
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                Add a database to get started, or try our demo databases.
              </Text>
              <div className="mt-6 flex gap-3">
                <Button href="/databases/new">Add Database</Button>
                <Button outline onClick={handleSetupDemo} disabled={setupDemo.isPending}>
                  {setupDemo.isPending ? 'Setting up...' : 'Try Demo Data'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <EmptyState
          icon={CircleStackIcon}
          title="No Databases Yet"
          message="No databases have been configured in this workspace. Contact your workspace admin to add databases."
        />
      </div>
    )
  }

  if (filteredDatabases.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <EmptyState
          icon={FunnelIcon}
          title="No Matches"
          message="No databases match your current filters. Try adjusting your search or filters to see more results."
        />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {filteredDatabases.map((database) => (
        <DatabaseCard
          key={database.id}
          database={database}
          accessByAccount={accessByAccount}
          pendingByAccount={pendingByAccount}
          searchQuery={searchQuery}
          accessFilter={accessFilter}
        />
      ))}
    </div>
  )
}
