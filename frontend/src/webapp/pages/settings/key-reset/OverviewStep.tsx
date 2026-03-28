import { AlertTriangleIcon, KeyRoundIcon } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'

interface OverviewStepProps {
  onStartReset: () => void
  onCancel: () => void
  isCreating: boolean
  error: string | null
}

export function OverviewStep({ onStartReset, onCancel, isCreating, error }: OverviewStepProps) {
  return (
    <div className="text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
        <KeyRoundIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>

      <Heading className="text-2xl">Reset Your Vault Passphrase</Heading>
      <Text className="mt-4 text-zinc-600 dark:text-zinc-400">
        You're about to create a new vault passphrase to replace your current one. Here's what will
        happen:
      </Text>

      <div className="mt-6 space-y-3 text-left">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
          <ol className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-zinc-900 dark:text-white">1.</span>
              <span>You'll create a new 12-word passphrase</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-zinc-900 dark:text-white">2.</span>
              <span>Your current passphrase will be revoked and cannot be used again</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-zinc-900 dark:text-white">3.</span>
              <span>
                An admin must approve your new passphrase before you can access credentials
              </span>
            </li>
          </ol>
        </div>

        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <Text className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Important:</strong> Once you confirm the reset, your old passphrase will be
              permanently blocked. Make sure you save your new passphrase securely.
            </Text>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Button outline onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={onStartReset} disabled={isCreating} className="flex-1">
          {isCreating ? 'Creating...' : 'Start Passphrase Reset'}
        </Button>
      </div>
    </div>
  )
}
