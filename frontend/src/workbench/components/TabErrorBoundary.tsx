import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/catalyst/button'

type TabErrorBoundaryProps = {
  tabId: string
  tabTitle: string
  children: ReactNode
  onRetry?: () => void
}

type TabErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  constructor(props: TabErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Tab "${this.props.tabTitle}" crashed:`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
          <div className="flex items-center gap-3 text-rose-500">
            <AlertTriangle className="h-8 w-8" />
            <span className="text-lg font-semibold">Tab Error</span>
          </div>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Something went wrong while rendering{' '}
            <span className="font-medium text-foreground">{this.props.tabTitle}</span>.
          </p>
          {this.state.error && (
            <pre className="max-w-lg overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <Button onClick={this.handleRetry}>
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
