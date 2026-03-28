import { Component, type ErrorInfo, type ReactNode, useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/catalyst/button'
import { useAppClient, useAppContext } from '@/lib/app-context'
import { useVaultContext } from '@/lib/vault-context'
import { useWorkbenchAccount } from '@/queries/databases'
import { usePageTitle } from '@/webapp/hooks'
import { WorkbenchProvider } from '@/workbench/context/WorkbenchProvider'
import { Workbench } from '@/workbench/Workbench'
import { createWebWorkbenchBackend } from '../workbenchBackend'

// ============================================================================
// Loading Screen
// ============================================================================

function LoadingScreen({ message = 'Loading Workbench...' }: { message?: string }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Error Boundary
// ============================================================================

type WorkbenchErrorBoundaryProps = {
  children: ReactNode
}

type WorkbenchErrorBoundaryState = {
  hasError: boolean
  message?: string
}

class WorkbenchErrorBoundary extends Component<
  WorkbenchErrorBoundaryProps,
  WorkbenchErrorBoundaryState
> {
  state: WorkbenchErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workbench crashed', error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background px-6 text-foreground">
          <div className="max-w-md text-center">
            <h1 className="text-lg font-semibold">Workbench failed to load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.message ?? 'An unexpected error occurred while rendering the workbench.'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={this.handleRetry}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// ============================================================================
// Main WorkbenchPage Component
// ============================================================================

export function WorkbenchPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const client = useAppClient()
  const { isLoading: contextLoading, getToken } = useAppContext()
  const { passphrase } = useVaultContext()

  // Fetch account/database info
  const {
    data: accountData,
    isLoading: accountLoading,
    error: accountError,
  } = useWorkbenchAccount(accountId ?? '', { enabled: !!accountId })

  usePageTitle(accountData?.account_name ?? 'Workbench')

  // Create backend with passphrase from vault context
  // The WebappVaultGate ensures passphrase is available before this page renders
  const backend = useMemo(() => {
    if (!accountId || !accountData) return null
    const databaseType = accountData.database_type === 'mysql' ? 'mysql' : 'postgres'
    return createWebWorkbenchBackend(accountId, databaseType, client, getToken, passphrase)
  }, [accountId, accountData, client, getToken, passphrase])

  // Handle loading states
  if (contextLoading || accountLoading) {
    return <LoadingScreen message="Loading Workbench..." />
  }

  // Handle missing account ID
  if (!accountId) {
    return <Navigate to="/" replace />
  }

  // Handle account fetch error
  if (accountError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-destructive">Failed to load account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {accountError instanceof Error ? accountError.message : 'Unknown error'}
          </p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  // Handle missing account data
  if (!accountData) {
    return <LoadingScreen message="Loading Workbench..." />
  }

  // Backend should be ready now (vault gate ensures passphrase is available)
  if (!backend) {
    return <LoadingScreen message="Initializing workbench..." />
  }

  return (
    <WorkbenchProvider
      key={accountData.account_id}
      backend={backend}
      accountId={accountData.account_id}
      accountName={accountData.account_name}
      databaseId={accountData.database_id}
      databaseName={accountData.database_name}
      databaseType={accountData.database_type}
      accessLevel={accountData.access_level as 'readonly' | 'write' | 'admin'}
      environment={
        accountData.environment as 'production' | 'staging' | 'testing' | 'development' | null
      }
    >
      <WorkbenchErrorBoundary>
        <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
          <Workbench />
        </div>
      </WorkbenchErrorBoundary>
    </WorkbenchProvider>
  )
}
