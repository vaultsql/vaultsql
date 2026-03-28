import { AlertTriangleIcon } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { openHelpScoutBeacon } from '@/components/HelpScoutBeacon'

interface SoloAdminScreenProps {
  onCancel: () => void
}

export function SoloAdminScreen({ onCancel }: SoloAdminScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
          <AlertTriangleIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>

        <Heading className="text-2xl">Contact Support for Passphrase Reset</Heading>
        <Text className="mt-4 text-zinc-600 dark:text-zinc-400">
          Vault passphrase resets require a second admin to approve for security. This prevents a
          compromised account from resetting access.
        </Text>
        <Text className="mt-4 text-zinc-600 dark:text-zinc-400">
          You are the only administrator in your workspace. Please{' '}
          <button
            type="button"
            onClick={openHelpScoutBeacon}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            contact our support team
          </button>{' '}
          and we'll verify your identity to help reset your passphrase.
        </Text>

        <div className="mt-8">
          <Button outline onClick={onCancel} className="w-full">
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
