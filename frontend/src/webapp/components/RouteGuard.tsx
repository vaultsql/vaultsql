import { Navigate, useLocation } from 'react-router-dom'
import { useAppContext } from '@/lib/app-context'
import { LoadingSpinner } from './LoadingSpinner'

type SessionType = 'none' | 'identity' | 'workspace'

interface RouteGuardProps {
  children: React.ReactNode
  allow: SessionType | SessionType[]
  fallback?: string
}

const DEFAULT_REDIRECTS: Record<SessionType, string> = {
  none: '/login',
  identity: '/onboarding/workspaces',
  workspace: '/',
}

// Routes that should not trigger a redirect back to themselves
const PUBLIC_AUTH_ROUTES = ['/login', '/signup', '/auth/']

export function RouteGuard({ children, allow, fallback }: RouteGuardProps) {
  const { sessionType, isAuthLoading } = useAppContext()
  const location = useLocation()

  if (isAuthLoading) {
    return <LoadingSpinner />
  }

  const allowedTypes = Array.isArray(allow) ? allow : [allow]

  if (!allowedTypes.includes(sessionType)) {
    let redirectTo = fallback ?? DEFAULT_REDIRECTS[sessionType]

    // When redirecting an authenticated user away from a public route (like /login),
    // check if there's a redirect param we should honor, but avoid redirecting
    // back to auth routes to prevent infinite loops
    if (sessionType !== 'none' && allowedTypes.includes('none')) {
      const searchParams = new URLSearchParams(location.search)
      const redirectParam = searchParams.get('redirect')

      if (redirectParam) {
        // Avoid infinite redirect loops by checking the redirect doesn't point
        // back to a public auth route
        const isAuthRoute = PUBLIC_AUTH_ROUTES.some((route) => redirectParam.startsWith(route))
        if (!isAuthRoute) {
          redirectTo = redirectParam
        }
      }
    }

    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
