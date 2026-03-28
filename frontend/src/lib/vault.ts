const PASSPHRASE_KEY = 'vaultsql:vault:passphrase'
const TIMESTAMP_KEY = 'vaultsql:vault:timestamp'

export interface VaultData {
  passphrase?: string
  validatedAt?: number
}

export async function getVaultData(): Promise<VaultData> {
  const passphrase = localStorage.getItem(PASSPHRASE_KEY)
  const validatedAt = localStorage.getItem(TIMESTAMP_KEY)
  return {
    passphrase: passphrase ?? undefined,
    validatedAt: validatedAt ? parseInt(validatedAt, 10) : undefined,
  }
}

export async function setVaultData(data: VaultData): Promise<void> {
  if (data.passphrase) localStorage.setItem(PASSPHRASE_KEY, data.passphrase)
  if (data.validatedAt) localStorage.setItem(TIMESTAMP_KEY, data.validatedAt.toString())
}

export async function clearVaultData(): Promise<void> {
  localStorage.removeItem(PASSPHRASE_KEY)
  localStorage.removeItem(TIMESTAMP_KEY)
}
