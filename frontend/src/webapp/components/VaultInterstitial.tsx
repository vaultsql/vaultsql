import type { ReactNode } from 'react'
import { WebappVaultGate } from './WebappVaultGate'

interface VaultInterstitialProps {
  children: ReactNode
}

/**
 * VaultInterstitial wraps content that requires vault access.
 * It shows full-page interstitials for key creation, approval, or unlock.
 *
 * This component now uses WebappVaultGate internally for consistent vault protection.
 */
export function VaultInterstitial({ children }: VaultInterstitialProps) {
  return <WebappVaultGate>{children}</WebappVaultGate>
}
