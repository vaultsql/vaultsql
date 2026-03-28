import type { ReactNode } from 'react'
import { AppLayout } from './AppLayout'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return <AppLayout>{children}</AppLayout>
}
