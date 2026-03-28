import { RouteGuard } from './RouteGuard'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <RouteGuard allow="workspace">{children}</RouteGuard>
}
