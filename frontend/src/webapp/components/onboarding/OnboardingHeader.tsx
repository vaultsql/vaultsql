import { Button } from '@/components/catalyst/button'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'

interface OnboardingHeaderProps {
  title: string
  description: string
  onLogout: () => void
}

export function OnboardingHeader({ title, description, onLogout }: OnboardingHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Heading>{title}</Heading>
        <Text>{description}</Text>
      </div>
      <Button plain compact onClick={onLogout} className="shrink-0">
        Log out
      </Button>
    </div>
  )
}
