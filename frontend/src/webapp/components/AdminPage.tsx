import { SettingsLayout } from '../pages/settings/SettingsLayout'
import { AdminRoute } from './AdminRoute'
import { MainLayout } from './MainLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { VaultInterstitial } from './VaultInterstitial'

interface AdminPageProps {
  children: React.ReactNode
  requiresVault?: boolean
  layout?: 'main' | 'settings' | 'none'
}

/**
 * Page wrapper that requires both authentication and admin role.
 * Non-admin users will be redirected to the home page.
 */
export function AdminPage({ children, requiresVault = false, layout = 'main' }: AdminPageProps) {
  const content = requiresVault ? <VaultInterstitial>{children}</VaultInterstitial> : children

  if (layout === 'none') {
    return (
      <ProtectedRoute>
        <AdminRoute>{content}</AdminRoute>
      </ProtectedRoute>
    )
  }

  if (layout === 'settings') {
    return (
      <ProtectedRoute>
        <AdminRoute>
          <MainLayout>
            <SettingsLayout>{content}</SettingsLayout>
          </MainLayout>
        </AdminRoute>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminRoute>
        <MainLayout>{content}</MainLayout>
      </AdminRoute>
    </ProtectedRoute>
  )
}
