import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { usePageTitle } from '@/webapp/hooks'

export function WorkspaceSettingsPage() {
  usePageTitle('Workspace Settings')
  return (
    <div className="p-8">
      <Heading>Workspace Settings</Heading>
      <Text>Configure workspace settings</Text>
    </div>
  )
}
