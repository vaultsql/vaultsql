import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { useVaultContext } from '@/lib/vault-context'
import { useIsAdmin } from '@/queries/user'

interface SettingsLayoutProps {
  children: ReactNode
}

interface NavItemProps {
  to: string
  children: ReactNode
}

function NavItem({ to, children }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-zinc-950/5 dark:bg-white/5 text-zinc-950 dark:text-white font-medium'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-950/5 dark:hover:bg-white/5'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const { isVaultMode } = useVaultContext()
  const isAdmin = useIsAdmin()

  return (
    <div className="p-8">
      <Heading>Settings</Heading>
      <Text className="mt-2">Manage your personal and workspace settings</Text>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        {/* Sidebar Navigation */}
        <nav className="space-y-6">
          <div className="space-y-1">
            <div className="px-3 mb-3">
              <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Personal Settings
              </Text>
            </div>
            <NavItem to="/settings/personal/profile">Your Information</NavItem>
            {isVaultMode && <NavItem to="/settings/personal/vault-key">Vault Keys</NavItem>}
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <div className="px-3 mb-3">
                <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Workspace Settings
                </Text>
              </div>
              <NavItem to="/settings/admin/workspace">Workspace Details</NavItem>
              <NavItem to="/settings/admin/audit">Audit Log</NavItem>
              <NavItem to="/settings/admin/requests">Access Requests</NavItem>
            </div>
          )}
        </nav>

        {/* Content Area */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
