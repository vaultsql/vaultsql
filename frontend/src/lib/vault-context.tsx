import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react'
import { useAppContext } from './app-context'

interface VaultContextValue {
  vaultReady: boolean
  isVaultMode: boolean
  passphrase: string | undefined
  lockVault: () => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

interface VaultProviderProps {
  children: ReactNode
}

export function VaultProvider({ children }: VaultProviderProps) {
  const { vault, workspaceMode, clearVault, isLoading } = useAppContext()

  const isVaultMode = workspaceMode === 'vault'
  const hasValidPassphrase = !!(vault.passphrase && vault.validatedAt)
  const vaultReady = !isVaultMode || hasValidPassphrase

  const lockVault = useCallback(async () => {
    await clearVault()
  }, [clearVault])

  const contextValue = useMemo(
    () => ({
      vaultReady,
      isVaultMode,
      passphrase: vault.passphrase,
      lockVault,
    }),
    [vaultReady, isVaultMode, vault.passphrase, lockVault],
  )

  if (isLoading) {
    return null
  }

  return <VaultContext.Provider value={contextValue}>{children}</VaultContext.Provider>
}

export function useVaultContext(): VaultContextValue {
  const context = useContext(VaultContext)
  if (!context) {
    throw new Error('useVaultContext must be used within a VaultProvider')
  }
  return context
}
