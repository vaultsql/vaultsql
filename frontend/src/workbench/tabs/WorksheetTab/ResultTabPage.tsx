import type { ReactNode } from 'react'
import { SimpleSplit } from '../../components/SimpleSplit'

type ResultTabPageProps = {
  worksheetPane: ReactNode
  resultsPane: ReactNode
}

export function ResultTabPage({ worksheetPane, resultsPane }: ResultTabPageProps) {
  return (
    <div className="flex h-full w-full flex-col bg-muted/20 p-2">
      <SimpleSplit
        className="flex-1 gap-2"
        direction="vertical"
        initialSizes={[55, 45]}
        gutterSize={4}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-border/70 bg-card shadow-sm">
          {worksheetPane}
        </div>
        <div className="flex h-full flex-col overflow-hidden rounded-md border border-border/70 bg-card shadow-sm">
          {resultsPane}
        </div>
      </SimpleSplit>
    </div>
  )
}
