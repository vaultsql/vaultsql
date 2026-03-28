import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Input } from '@/components/catalyst/input'
import { ImageUpload } from '@/components/ImageUpload'
import { SettingsFooter, SettingsForm, SettingsHeader, SettingsSection, SettingsDivider } from '@/components/settings-form'
// import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { useUpdateProfile, useUploadAvatar, useUser } from '@/queries/user'
import { usePageTitle } from '@/webapp/hooks'

interface PersonalProfileFormData {
  full_name: string
}

export function PersonalProfilePage() {
  usePageTitle('Personal Profile')
  const { data: user } = useUser()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  const form = useForm<PersonalProfileFormData>({
    defaultValues: {
      full_name: '',
    },
  })

  // Initialize form with user data
  useEffect(() => {
    if (user?.user?.name) {
      form.reset({
        full_name: user.user.name,
      })
    }
  }, [user, form])

  const onSubmit = async (data: PersonalProfileFormData) => {
    try {
      await updateProfile.mutateAsync({
        name: data.full_name,
      })
    } catch (error) {
      console.error('Failed to update profile:', error)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    setUploadError(null)
    try {
      await uploadAvatar.mutateAsync(file)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image')
    }
  }

  const getInitials = () => {
    const name = user?.user?.name
    const email = user?.user?.email
    
    if (name) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    return email?.substring(0, 2).toUpperCase() || ''
  }

  return (
    <SettingsForm form={form} onSubmit={onSubmit}>
      <SettingsHeader>Your Information</SettingsHeader>

      <SettingsSection
        title="Profile Picture"
        description="Upload a profile picture to personalize your account."
      >
        <ImageUpload
          currentImageUrl={user?.user?.image_url}
          initials={getInitials()}
          onUpload={handleAvatarUpload}
          isUploading={uploadAvatar.isPending}
          error={uploadError}
        />
      </SettingsSection>

      <SettingsDivider />

      <SettingsSection
        title="Full Name"
        description="Your full name as it will appear across the platform."
      >
        <Input aria-label="Full Name" placeholder="John Doe" {...form.register('full_name')} />
      </SettingsSection>

      {/* <SettingsDivider />

      <SettingsSection
        title="Appearance"
        description="Choose how VaultSQL looks to you."
      >
        <ThemeSwitcher />
      </SettingsSection> */}

      <SettingsFooter showReset={false} />
    </SettingsForm>
  )
}
