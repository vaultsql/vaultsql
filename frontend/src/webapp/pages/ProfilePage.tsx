import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { usePageTitle } from '@/webapp/hooks'

export function ProfilePage() {
  usePageTitle('Profile')
  return (
    <div className="p-8">
      <Heading>Profile</Heading>
      <Text>Your profile information</Text>
    </div>
  )
}
