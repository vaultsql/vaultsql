import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { usePageTitle } from '@/webapp/hooks'

export function ShareFeedbackPage() {
  usePageTitle('Share Feedback')
  return (
    <div className="p-8">
      <Heading>Share Feedback</Heading>
      <Text>Tell us what you think</Text>
    </div>
  )
}
