import {
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  LifeBuoyIcon,
  LockIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { openHelpScoutBeacon } from '@/components/HelpScoutBeacon'
import { useAppContext } from '@/lib/app-context'
import { useTestPassphrase, useUser } from '@/queries/user'
import { LoadingSpinner } from './LoadingSpinner'
import { VaultKeyEmptyState } from './VaultKeyEmptyState'

type GateStatus = 'loading' | 'needs_create' | 'needs_approval' | 'needs_unlock' | 'unlocked'

interface WebappVaultGateProps {
  children: ReactNode
}

export function WebappVaultGate({ children }: WebappVaultGateProps) {
  const { vault, setVault, workspaceMode, isLoading: contextLoading } = useAppContext()
  const { data: userData, isLoading: userLoading } = useUser()
  const testPassphrase = useTestPassphrase()

  const [gateStatus, setGateStatus] = useState<GateStatus>('loading')
  const validationInProgress = useRef(false)
  const validationComplete = useRef(false)

  // Determine gate status based on workspace mode, user flags, and stored passphrase
  useEffect(() => {
    async function determineStatus() {
      // If already unlocked, don't re-evaluate
      if (gateStatus === 'unlocked') {
        return
      }

      // Still loading context or user data - wait for it to complete
      if (contextLoading || userLoading) {
        return
      }

      // workspaceMode === null means we haven't loaded it yet, keep loading
      if (workspaceMode === null) {
        return
      }

      // If workspace is in managed mode, skip the gate entirely
      if (workspaceMode === 'managed') {
        setGateStatus('unlocked')
        return
      }

      // No user data means something went wrong
      if (!userData) {
        return
      }

      // Derive key state from userData.key:
      // - key is null → needs_key_create
      // - key.approved_at is null → needs_key_approval
      // - key.approved_at is set → active key ready for use
      if (!userData.key) {
        setGateStatus('needs_create')
        return
      }

      if (!userData.key.approved_at) {
        setGateStatus('needs_approval')
        return
      }

      // User has an active key - check if we have a valid stored passphrase
      const hasStoredPassphrase = vault.passphrase && vault.validatedAt

      if (hasStoredPassphrase && !validationComplete.current && !validationInProgress.current) {
        // Validate the stored passphrase - keep showing loading until done
        validationInProgress.current = true
        try {
          const result = await testPassphrase.mutateAsync(vault.passphrase!)
          validationComplete.current = true
          validationInProgress.current = false
          if (result.success) {
            setGateStatus('unlocked')
            return
          }
          // Validation failed, show unlock screen
          setGateStatus('needs_unlock')
        } catch {
          validationComplete.current = true
          validationInProgress.current = false
          setGateStatus('needs_unlock')
        }
        return
      }

      // If validation is in progress, stay in loading state
      if (validationInProgress.current) {
        return
      }

      // No stored passphrase or validation already complete and failed
      if (!hasStoredPassphrase || validationComplete.current) {
        setGateStatus('needs_unlock')
      }
    }

    determineStatus()
  }, [contextLoading, userLoading, workspaceMode, userData, vault, testPassphrase, gateStatus])

  // Reset validation state when passphrase is cleared
  useEffect(() => {
    if (!vault.passphrase) {
      validationComplete.current = false
      validationInProgress.current = false
    }
  }, [vault.passphrase])

  // Render appropriate screen based on gate status
  if (gateStatus === 'loading') {
    return <LoadingSpinner message="Loading..." />
  }

  if (gateStatus === 'needs_create' || gateStatus === 'needs_approval') {
    return <VaultKeyEmptyState needsCreate={gateStatus === 'needs_create'} />
  }

  if (gateStatus === 'needs_unlock') {
    return (
      <UnlockScreen
        passphraseHint={userData?.key?.passphrase_hint}
        onSuccess={async (passphrase) => {
          // Mark validation complete so effect doesn't re-run validation
          validationComplete.current = true
          await setVault({ passphrase, validatedAt: Date.now() })
          setGateStatus('unlocked')
        }}
      />
    )
  }

  // Unlocked - render children
  return <>{children}</>
}

// ============================================================================
// Unlock Screen
// ============================================================================

interface UnlockScreenProps {
  passphraseHint?: string
  onSuccess: (passphrase: string) => void
}

function UnlockScreen({ passphraseHint, onSuccess }: UnlockScreenProps) {
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const testPassphrase = useTestPassphrase()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) return

    setError(null)
    try {
      const result = await testPassphrase.mutateAsync(passphrase)
      if (result.success) {
        onSuccess(passphrase)
      } else {
        setError("That passphrase didn't match. Check for typos - passphrases are case-sensitive.")
        setPassphrase('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 w-fit">
            <LockIcon className="w-6 h-6 text-primary" />
          </div>
          <Heading className="text-xl">Unlock Vault</Heading>
          <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
            Enter your vault passphrase to continue.
          </Text>
          <div className="mt-3 min-h-[28px] flex items-center justify-center">
            {passphraseHint && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md text-xs text-blue-700 dark:text-blue-300">
                <span className="font-medium">First words:</span>
                <span className="font-mono">{passphraseHint}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter your 12-word passphrase"
                className="w-full px-3 py-2 pr-10 bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
                autoFocus
                disabled={testPassphrase.isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showPassphrase ? (
                  <EyeOffIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={testPassphrase.isPending || !passphrase.trim()}
          >
            {testPassphrase.isPending ? 'Validating...' : 'Unlock Vault'}
          </Button>
        </form>

        {/* Help Links */}
        <div className="mt-16 space-y-3">
          <button
            type="button"
            onClick={openHelpScoutBeacon}
            className="block w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group text-left"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-md group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <LifeBuoyIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Contact Support
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  If you have any trouble or questions, we're here to help.
                </p>
              </div>
            </div>
          </button>

          <a
            href="https://docs.vaultsql.com/vault-mode"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-950/50 rounded-md group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <ShieldCheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Learn About Vault Mode
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Understand the concepts of vault mode and what makes it secure.
                </p>
              </div>
            </div>
          </a>

          <a
            href="/settings/key-reset"
            className="block p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-950/50 rounded-md group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                <KeyRoundIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Misplaced Your Passphrase?
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Start the passphrase reset process to regain access.
                </p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
