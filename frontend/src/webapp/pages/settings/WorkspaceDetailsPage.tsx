import { useEffect, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Divider } from '@/components/catalyst/divider'
import { Label } from '@/components/catalyst/fieldset'
import { Heading, Subheading } from '@/components/catalyst/heading'
import { Input } from '@/components/catalyst/input'
import { Text } from '@/components/catalyst/text'
import { ImageUpload } from '@/components/ImageUpload'
import { useUpdateWorkspaceSettings, useUploadWorkspaceImage, useWorkspaceSettings } from '@/queries/settings'
import { useUser } from '@/queries/user'
import { usePageTitle } from '@/webapp/hooks'

export function WorkspaceDetailsPage() {
  usePageTitle('Workspace Details')
  const { data: settings, isLoading } = useWorkspaceSettings()
  const { data: user } = useUser()
  const updateSettings = useUpdateWorkspaceSettings()
  const uploadWorkspaceImage = useUploadWorkspaceImage()
  const [workspaceName, setWorkspaceName] = useState('')
  const [allowOwnDomain, setAllowOwnDomain] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Initialize form state when settings load
  useEffect(() => {
    if (settings) {
      setWorkspaceName(settings.workspace_name || '')
      setAllowOwnDomain(
        settings.allowed_email_domains && settings.allowed_email_domains.length > 0,
      )
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const adminDomain = settings?.admin_email_domain
      if (!adminDomain) {
        console.error('Admin email domain not available')
        return
      }

      // Only allow admin's own domain
      const domains = allowOwnDomain ? [adminDomain] : []

      await updateSettings.mutateAsync({
        workspace_name: workspaceName,
        allowed_email_domains: domains,
      })
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageUpload = async (file: File) => {
    setUploadError(null)
    try {
      await uploadWorkspaceImage.mutateAsync(file)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image')
    }
  }

  const getWorkspaceInitial = () => {
    const name = user?.workspace?.name || workspaceName
    return name ? name.charAt(0).toUpperCase() : 'W'
  }

  const adminDomain = settings?.admin_email_domain

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      <Heading>Workspace Details</Heading>
      <Divider className="my-6 mt-4" />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Workspace Image</Subheading>
          <Text>Upload an image to represent your workspace.</Text>
        </div>
        <div>
          <ImageUpload
            currentImageUrl={user?.workspace?.image_url}
            initials={getWorkspaceInitial()}
            onUpload={handleImageUpload}
            isUploading={uploadWorkspaceImage.isPending}
            error={uploadError}
            square
            label="Workspace Image"
          />
        </div>
      </section>

      <Divider className="my-10" soft />

      <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Subheading>Workspace Name</Subheading>
          <Text>The name of your workspace visible to all members.</Text>
        </div>
        <div>
          <Input
            aria-label="Workspace Name"
            name="name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="My Workspace"
            disabled={isLoading}
          />
        </div>
      </section>

      {!settings?.is_free_email_domain && (
        <>
          <Divider className="my-10" soft />

          <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className="space-y-1">
              <Subheading>Allowed Email Domains</Subheading>
              <Text>
                Allow users from your email domain to join the workspace without an invite code. To
                add other domains, contact support.
              </Text>
            </div>
            <div className="flex items-center">
              <CheckboxField>
                <Checkbox
                  checked={allowOwnDomain}
                  onChange={setAllowOwnDomain}
                  disabled={isLoading || !adminDomain}
                />
                <Label>
                  Allow any user from <strong>{adminDomain || 'your domain'}</strong> to join{' '}
                  <strong>{workspaceName || 'this workspace'}</strong>
                </Label>
              </CheckboxField>
            </div>
          </section>
        </>
      )}

      <Divider className="my-10" soft />

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isSaving || isLoading}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
