import { ClockIcon, LockClosedIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import type { Access } from '@/queries/access'
import type { Account, Database } from '@/queries/databases'
import { useIsAdmin } from '@/queries/user'
import { RequestAccessDialog } from '@/webapp/components/RequestAccessDialog'
import { getAccessLevelBadgeColor, getAccessLevelLabel } from '@/webapp/utils/access-badges'
import { getAccessLevelIcon } from './icons'
import { formatAccessExpiry } from './utils'

interface AccountRowProps {
  account: Account
  database: Database
  access?: Access
  pendingAccess?: Access
}

export function AccountRow({ account, database, access, pendingAccess }: AccountRowProps) {
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const isAdmin = useIsAdmin()
  // Admins have implicit access to all accounts, so they can always connect
  const hasAccess = isAdmin || Boolean(access)
  const hasPendingRequest = Boolean(pendingAccess)
  const isDatabaseActive = database.is_active

  const accessExpiryLabel = access?.granted_until
    ? `Until ${formatAccessExpiry(access.granted_until)}`
    : null

  return (
    <>
      <div className="group/row flex items-center justify-between gap-4 px-6 py-2.5 pl-12 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50">
        {/* Left: Icon + Account Info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div>{getAccessLevelIcon(account.access_level)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <span
                className={`text-sm font-medium ${
                  hasPendingRequest
                    ? 'text-amber-700 dark:text-amber-400'
                    : hasAccess
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {account.name}
              </span>
              <Badge color={getAccessLevelBadgeColor(account.access_level)} className="text-xs">
                {getAccessLevelLabel(account.access_level)}
              </Badge>
            </div>
            {accessExpiryLabel && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{accessExpiryLabel}</span>
            )}
            {account.description && (
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {account.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Action Button */}
        <div className="flex-shrink-0">
          {!isDatabaseActive ? (
            <Button disabled outline>
              Inactive
            </Button>
          ) : hasAccess ? (
            <Button href={`/workbench/${account.id}`}>Connect</Button>
          ) : hasPendingRequest ? (
            <Button disabled outline className="text-amber-700 dark:text-amber-400">
              <ClockIcon className="-ml-1 mr-1.5 h-4 w-4" />
              Pending
            </Button>
          ) : (
            <Button outline onClick={() => setShowRequestDialog(true)}>
              <LockClosedIcon className="-ml-1 mr-1.5 h-4 w-4" />
              Request
            </Button>
          )}
        </div>
      </div>

      <RequestAccessDialog
        open={showRequestDialog}
        onClose={() => setShowRequestDialog(false)}
        databaseId={database.id}
        accountId={account.id}
        accountName={account.name}
        databaseName={database.name}
      />
    </>
  )
}
