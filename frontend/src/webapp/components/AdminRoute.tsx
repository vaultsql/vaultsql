import { Navigate } from 'react-router-dom'
import { useIsAdmin, useUser } from '@/queries/user'
import { LoadingSpinner } from './LoadingSpinner'

interface AdminRouteProps {
  children: React.ReactNode
  fallback?: string
}

/**
 * Route guard that only allows admin users to access the wrapped content.
 * Non-admin users are redirected to the home page.
 */
export function AdminRoute({ children, fallback = '/' }: AdminRouteProps) {
  const { isLoading } = useUser()
  const isAdmin = useIsAdmin()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!isAdmin) {
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}
