import type { ReactNode } from 'react'

interface ContentCardProps {
  children: ReactNode
}

export function ContentCard({ children }: ContentCardProps) {
  return <div className="rounded-lg border border-border bg-card p-6">{children}</div>
}
