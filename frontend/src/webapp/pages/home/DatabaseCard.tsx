import { Disclosure } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { Badge } from '@/components/catalyst/badge'
import type { Access } from '@/queries/access'
import { type Database, useDatabaseAccounts } from '@/queries/databases'
import { getEnvironmentBadgeColor, getEnvironmentLabel } from '@/webapp/utils/access-badges'
import { AccountRow } from './AccountRow'
import { ServerIcon } from './icons'
import type { AccessFilter } from './types'
import { getEnvironmentBorder } from './utils'

interface DatabaseCardProps {
  database: Database
  accessByAccount: Map<string, Access>
  pendingByAccount: Map<string, Access>
  searchQuery: string
  accessFilter: AccessFilter
}

export function DatabaseCard({
  database,
  accessByAccount,
  pendingByAccount,
  searchQuery,
  accessFilter,
}: DatabaseCardProps) {
  return (
    <Disclosure>
      {({ open }) => (
        <DatabaseCardContent
          database={database}
          accessByAccount={accessByAccount}
          pendingByAccount={pendingByAccount}
          searchQuery={searchQuery}
          accessFilter={accessFilter}
          open={open}
        />
      )}
    </Disclosure>
  )
}

interface DatabaseCardContentProps extends DatabaseCardProps {
  open: boolean
}

function DatabaseCardContent({
  database,
  accessByAccount,
  pendingByAccount,
  searchQuery,
  accessFilter,
  open,
}: DatabaseCardContentProps) {
  const { data: accounts = [], isLoading } = useDatabaseAccounts(database.id, { enabled: open })

  if (!open && accounts.length === 0 && !isLoading) {
    return (
      <div
        className={`group rounded-lg border border-border bg-card py-4 transition hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 ${getEnvironmentBorder(database.environment)}`}
      >
        <Disclosure.Button className="flex w-full items-start justify-between gap-4 px-6 text-left">
          <DatabaseHeader database={database} />
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-mono">{database.database_type}</span>
            <ChevronDownIcon
              className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </Disclosure.Button>
      </div>
    )
  }

  const filteredAccounts = accounts.filter((account) => {
    const hasAccess = Boolean(accessByAccount.get(account.id))
    const hasPending = Boolean(pendingByAccount.get(account.id))

    if (accessFilter !== 'all') {
      if (accessFilter === 'pending' && !hasPending) return false
      if (accessFilter === 'no-access' && (hasAccess || hasPending)) return false
    }

    if (searchQuery) {
      const accountHaystack = [account.name, account.description ?? ''].join(' ').toLowerCase()
      if (!accountHaystack.includes(searchQuery)) return false
    }

    return true
  })

  return (
    <div
      className={`group rounded-lg border border-border bg-card py-4 transition hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 ${getEnvironmentBorder(database.environment)}`}
    >
      {/* Database Header */}
      <div className="flex items-start justify-between gap-4 px-6">
        <Disclosure.Button className="flex w-full items-start justify-between gap-4 text-left">
          <DatabaseHeader database={database} />
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-mono">{database.database_type}</span>
            <ChevronDownIcon
              className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </Disclosure.Button>
      </div>

      {/* Account List */}
      {open && (
        <div>
          {isLoading ? (
            <div className="mt-3 px-6 text-sm text-zinc-500">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="mt-3 px-6 text-sm text-zinc-500">
              No accounts configured yet. An admin needs to set up accounts before you can connect.
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="mt-3 px-6 text-sm text-zinc-500">No accounts match your filters.</div>
          ) : (
            <div className="mt-3 space-y-0.5">
              {filteredAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  database={database}
                  access={accessByAccount.get(account.id)}
                  pendingAccess={pendingByAccount.get(account.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DatabaseHeader({ database }: { database: Database }) {
  return (
    <div className="flex items-start gap-3">
      <ServerIcon databaseType={database.database_type} isActive={database.is_active} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {database.name}
          </h3>
          {database.is_demo && (
            <Badge color="purple" className="text-xs">
              Demo
            </Badge>
          )}
          {database.environment && (
            <Badge
              color={getEnvironmentBadgeColor(database.environment)}
              className="text-xs uppercase"
            >
              {getEnvironmentLabel(database.environment)}
            </Badge>
          )}
          {!database.is_active && (
            <Badge color="zinc" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
        {database.description && (
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{database.description}</p>
        )}
      </div>
    </div>
  )
}
