import React from 'react'

interface AppErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log for debugging; could be wired to observability later
    console.error('App error boundary caught an error', { error, info })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[50vh] w-full flex-col items-center justify-center bg-white dark:bg-zinc-900 p-6">
          <div className="max-w-md space-y-4 text-center border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm rounded-xl">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              The page crashed. Please try again or refresh. If this keeps happening, reach out to
              support.
            </p>
            {this.state.error && (
              <p className="text-xs text-zinc-500 dark:text-zinc-500 break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
