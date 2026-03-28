import { ClockIcon } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'

interface AwaitingApprovalStepProps {
  onReturn: () => void
}

export function AwaitingApprovalStep({ onReturn }: AwaitingApprovalStepProps) {
  return (
    <div className="text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/50">
        <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>

      <Heading className="text-2xl">Passphrase Reset Complete</Heading>
      <Text className="mt-4 text-zinc-600 dark:text-zinc-400">
        Your new vault passphrase has been created and your old passphrase has been revoked.
      </Text>
      <Text className="mt-4 text-zinc-600 dark:text-zinc-400">
        An admin must approve your new passphrase to ensure security - this prevents unauthorized
        access. We've notified your workspace admins. You'll be able to access credentials once
        approved.
      </Text>

      <div className="mt-8">
        <Button onClick={onReturn} className="w-full">
          Return to Home
        </Button>
      </div>
    </div>
  )
}
