import { RouteGuard } from './RouteGuard'

interface PublicRouteProps {
  children: React.ReactNode
}

export function PublicRoute({ children }: PublicRouteProps) {
  return <RouteGuard allow="none">{children}</RouteGuard>
}
