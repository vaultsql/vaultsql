import { SettingsLayout } from '../pages/settings/SettingsLayout'
import { MainLayout } from './MainLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { VaultInterstitial } from './VaultInterstitial'

interface ProtectedPageProps {
  children: React.ReactNode
  requiresVault?: boolean
  layout?: 'main' | 'settings' | 'none'
}

export function ProtectedPage({
  children,
  requiresVault = false,
  layout = 'main',
}: ProtectedPageProps) {
  const content = requiresVault ? <VaultInterstitial>{children}</VaultInterstitial> : children

  if (layout === 'none') {
    return <ProtectedRoute>{content}</ProtectedRoute>
  }

  if (layout === 'settings') {
    return (
      <ProtectedRoute>
        <MainLayout>
          <SettingsLayout>{content}</SettingsLayout>
        </MainLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <MainLayout>{content}</MainLayout>
    </ProtectedRoute>
  )
}
