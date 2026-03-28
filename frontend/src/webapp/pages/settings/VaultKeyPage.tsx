import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import {
  SettingsActions,
  SettingsDivider,
  SettingsHeader,
  SettingsPage,
} from '@/components/settings-form'
import { useVaultContext } from '@/lib/vault-context'
import { type UserKey, useMyKeys } from '@/queries/keys'
import { usePageTitle } from '@/webapp/hooks'

export function VaultKeyPage() {
  usePageTitle('Vault Key')
  const { isVaultMode } = useVaultContext()
  const { data: keys = [], isLoading: keysLoading } = useMyKeys({ enabled: isVaultMode })

  const getKeyStatus = (key: UserKey) => {
    if (key.revoked_at) return { label: 'Revoked', color: 'rose' as const }
    if (!key.confirmed_at) return { label: 'Not confirmed', color: 'zinc' as const }
    if (key.approved_at) return { label: 'Approved', color: 'emerald' as const }
    return { label: 'Pending approval', color: 'amber' as const }
  }

  if (!isVaultMode) {
    return (
      <SettingsPage>
        <SettingsHeader>Vault Keys</SettingsHeader>
        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
          This workspace uses end-to-end encryption (vault mode). Your personal passphrase is
          required to decrypt database credentials.
        </Text>
      </SettingsPage>
    )
  }

  return (
    <div className="max-w-3xl space-y-12">
      <SettingsPage>
        <SettingsHeader>Vault Keys</SettingsHeader>
        <SettingsActions
          title="Your vault passphrase"
          description="Your passphrase stays on your device and is never sent to our servers. It's the only way to decrypt your database credentials - even we can't access them without it."
        >
          <div className="space-y-3">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              You can only view your passphrase once, when it is created. Store it somewhere safe -
              we can't recover it for you.
            </Text>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                Generating a new passphrase will invalidate your existing one.
              </Text>
              <Button href="/settings/key-reset">Generate new passphrase</Button>
            </div>
          </div>
        </SettingsActions>
      </SettingsPage>

      <SettingsDivider />

      <SettingsPage>
        <SettingsActions
          title="Previous passphrases"
          description="Only the first two words are shown to help you identify each passphrase."
        >
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <Text className="text-sm font-medium">Passphrase history</Text>
            </div>
            <div className="px-4 py-3">
              {keysLoading && (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  Loading passphrases...
                </Text>
              )}
              {!keysLoading && keys.length === 0 && (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  No passphrases yet.
                </Text>
              )}
              {!keysLoading && keys.length > 0 && (
                <Table dense striped>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Created</TableHeader>
                      <TableHeader>First words</TableHeader>
                      <TableHeader>Status</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {keys.map((key) => {
                      const status = getKeyStatus(key)
                      return (
                        <TableRow key={key.id}>
                          <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                            {new Date(key.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                            {key.passphrase_hint || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge color={status.color}>{status.label}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </SettingsActions>
      </SettingsPage>
    </div>
  )
}
