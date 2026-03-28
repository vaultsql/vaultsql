import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AuthLayout } from '@/components/catalyst/auth-layout'
import { ErrorMessage } from '@/components/catalyst/fieldset'
import { clearAuthToken, setAuthToken } from '@/lib/auth'
import { clearVaultData } from '@/lib/vault'
import { useIdentityMe, useIdentityWorkspaces, useJoinWorkspace } from '@/queries/identity'
import { useLogout } from '@/queries/user'
import {
  AvailableWorkspacesList,
  CollapsibleCreateWorkspace,
  CreateWorkspaceForm,
  OnboardingHeader,
  WorkspaceInviteView,
} from '@/webapp/components/onboarding'
import { usePageTitle } from '@/webapp/hooks'

export function OnboardingWorkspacesPage() {
  usePageTitle('Join or Create Workspace')
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('invite_code')

  const [error, setError] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const identityMe = useIdentityMe()
  const availableWorkspaces = useIdentityWorkspaces({ join: true })
  const joinWorkspace = useJoinWorkspace()
  const logout = useLogout()

  const handleLogout = async () => {
    try {
      await logout.mutateAsync()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      clearAuthToken()
      await clearVaultData()
      queryClient.clear()
      window.location.assign('/login')
    }
  }

  const handleWorkspaceSuccess = (token: string) => {
    setAuthToken(token)
    window.location.assign('/')
  }

  const handleJoinWorkspace = async (workspaceId: string, userName: string) => {
    setError(null)
    try {
      const data = await joinWorkspace.mutateAsync({
        workspaceId,
        inviteCode: null,
        userName,
      })

      handleWorkspaceSuccess(data.token)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'There was an error joining the workspace. Please try again.',
      )
    }
  }

  // Handle invite code flow
  if (inviteCode) {
    return (
      <WorkspaceInviteView
        inviteCode={inviteCode}
        onLogout={handleLogout}
        onSuccess={handleWorkspaceSuccess}
        defaultName={identityMe.data?.name || ''}
      />
    )
  }

  // Show available workspaces (with allowed domains) if any exist
  if (!inviteCode && availableWorkspaces.data && availableWorkspaces.data.length > 0) {
    return (
      <AuthLayout panelClassName="max-w-2xl">
        <div className="w-full space-y-6">
          <OnboardingHeader
            title="Join Workspace"
            description="You can join these workspaces with your email domain."
            onLogout={handleLogout}
          />

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <AvailableWorkspacesList
            workspaces={availableWorkspaces.data}
            onJoin={handleJoinWorkspace}
            isJoining={joinWorkspace.isPending}
            defaultName={identityMe.data?.name || ''}
          />

          <CollapsibleCreateWorkspace
            onSuccess={handleWorkspaceSuccess}
            onError={(err) => setError(err)}
            defaultName={identityMe.data?.name || ''}
          />
        </div>
      </AuthLayout>
    )
  }

  // Default: show create workspace form
  return (
    <AuthLayout panelClassName="max-w-2xl">
      <div className="w-full space-y-6">
        <OnboardingHeader
          title="Create your workspace"
          description="Get started by creating a new workspace for your team."
          onLogout={handleLogout}
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <CreateWorkspaceForm
          onSuccess={handleWorkspaceSuccess}
          onError={(err) => setError(err)}
          defaultName={identityMe.data?.name || ''}
        />
      </div>
    </AuthLayout>
  )
}
