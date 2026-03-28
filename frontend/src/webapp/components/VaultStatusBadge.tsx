import { ShieldCheckIcon } from 'lucide-react'
import { useVaultContext } from '@/lib/vault-context'
import { VaultInfoPopover } from './VaultInfoPopover'

export function VaultStatusBadge() {
  const { vaultReady, isVaultMode } = useVaultContext()

  if (!isVaultMode) {
    return null
  }

  // Vault gate ensures vault is always unlocked when viewing protected pages
  // So we only show the "active" state
  if (vaultReady) {
    return (
      <VaultInfoPopover>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-500/25 dark:hover:bg-green-500/20 transition-colors cursor-pointer">
          <ShieldCheckIcon className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">Vault Mode Active</span>
        </button>
      </VaultInfoPopover>
    )
  }

  return null
}
