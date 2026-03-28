import type { ReactNode } from 'react'
import { useAppContext } from '@/lib/app-context'
import { useUser } from '@/queries/user'
import { LoadingSpinner } from './LoadingSpinner'

interface AppLoadingGateProps {
  children: ReactNode
}

/**
 * Top-level loading gate that ensures all essential app data is loaded
 * before rendering any routes. This prevents flashes of content while
 * checking authentication, vault status, and user data.
 */
export function AppLoadingGate({ children }: AppLoadingGateProps) {
  const { isLoading: appContextLoading } = useAppContext()
  const { isLoading: userLoading } = useUser()

  // Wait for both app context (auth + vault) and user data to be ready
  if (appContextLoading || userLoading) {
    return <LoadingSpinner message="Loading..." />
  }

  return <>{children}</>
}
