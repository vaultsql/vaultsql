import { RouteGuard } from './RouteGuard'

interface OnboardingRouteProps {
  children: React.ReactNode
}

export function OnboardingRoute({ children }: OnboardingRouteProps) {
  return <RouteGuard allow="identity">{children}</RouteGuard>
}
