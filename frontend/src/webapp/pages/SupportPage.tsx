import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { usePageTitle } from '@/webapp/hooks'

export function SupportPage() {
  usePageTitle('Support')
  return (
    <div className="p-8">
      <Heading>Support</Heading>
      <Text>Get help with VaultSQL</Text>
    </div>
  )
}
