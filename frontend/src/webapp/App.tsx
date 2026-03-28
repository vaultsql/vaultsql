import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Toaster } from 'sonner'
import { HelpScoutBeacon } from '@/components/HelpScoutBeacon'
import { ThemeProvider } from '@/components/theme-provider'
import { type AppConfig, AppProvider, useAppContext } from '@/lib/app-context'
import { getAuthToken } from '@/lib/auth'
import { VaultProvider } from '@/lib/vault-context'
import { getApiErrorStatus } from '@/queries/user-query'
import { AdminPage, AppLoadingGate, LoadingSpinner } from './components'
import { AuthErrorProvider, isInvalidTokenError } from './components/AuthErrorModal'
import { OnboardingRoute } from './components/OnboardingRoute'
import { ProtectedPage } from './components/ProtectedPage'
import { PublicRoute } from './components/PublicRoute'
import {
  AccessRequestsPage,
  AddDatabasePage,
  AuditSettingsPage,
  DatabasePage,
  DevLoginPage,
  GoogleAuthCompletePage,
  GroupsPage,
  HomePage,
  InboxPage,
  KeyResetPage,
  LoginPage,
  MembersPage,
  NotFoundPage,
  OnboardingWorkspacesPage,
  PersonalProfilePage,
  ProfilePage,
  SettingsLayout,
  SettingsPage,
  ShareFeedbackPage,
  SignupPage,
  SupportPage,
  VaultKeyPage,
  WorkspaceDetailsPage,
  WorkspaceSettingsPage,
} from './pages'

const WorkbenchPage = lazy(() =>
  import('./pages/WorkbenchPage').then((module) => ({ default: module.WorkbenchPage })),
)

function InviteRedirect() {
  const { token } = useParams<{ token: string }>()
  return <Navigate to={`/signup?invite_code=${token}`} replace />
}

// Global ref for auth error callback - set by AuthErrorProvider
let authErrorCallback: (() => void) | null = null

export function setAuthErrorCallback(cb: () => void) {
  authErrorCallback = cb
}

function shouldIgnoreAuthError(error: unknown, queryKey: readonly unknown[] | undefined) {
  // Always ignore errors from the 'me' query - VaultGate components handle these gracefully
  // This prevents transient backend errors (500, 502, network issues) from triggering logout
  return queryKey?.[0] === 'me'
}

function handleGlobalQueryError(error: unknown, query?: { queryKey?: readonly unknown[] }) {
  if (shouldIgnoreAuthError(error, query?.queryKey)) return
  if (isInvalidTokenError(error) && authErrorCallback) {
    authErrorCallback()
  }
}

function handleGlobalMutationError(error: unknown) {
  if (isInvalidTokenError(error) && authErrorCallback) {
    authErrorCallback()
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalQueryError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalMutationError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh, preventing unnecessary refetches
      gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache
      refetchOnWindowFocus: false, // Disable refetch on window focus
      retry: (failureCount, error) => {
        // Don't retry on invalid token errors
        if (isInvalidTokenError(error)) return false
        return failureCount < 1
      },
    },
  },
})

const appConfig: AppConfig = {
  baseUrl: import.meta.env.VITE_API_URL || '/',
  fetch: globalThis.fetch,
  getToken: getAuthToken,
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/invite/:token"
        element={
          <PublicRoute>
            <InviteRedirect />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route
        path="/auth/devlogin/:suffix?"
        element={
          <PublicRoute>
            <DevLoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/auth/complete/google"
        element={
          <PublicRoute>
            <GoogleAuthCompletePage />
          </PublicRoute>
        }
      />

      {/* Onboarding routes */}
      <Route
        path="/onboarding/workspaces"
        element={
          <OnboardingRoute>
            <OnboardingWorkspacesPage />
          </OnboardingRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedPage requiresVault>
            <HomePage />
          </ProtectedPage>
        }
      />
      <Route
        path="/inbox"
        element={
          <AdminPage requiresVault>
            <InboxPage />
          </AdminPage>
        }
      />
      <Route
        path="/groups"
        element={
          <AdminPage>
            <GroupsPage />
          </AdminPage>
        }
      />
      <Route
        path="/members"
        element={
          <AdminPage>
            <MembersPage />
          </AdminPage>
        }
      />
      <Route
        path="/database/:databaseId"
        element={
          <AdminPage requiresVault>
            <DatabasePage />
          </AdminPage>
        }
      />
      <Route
        path="/database/add"
        element={
          <AdminPage requiresVault>
            <AddDatabasePage />
          </AdminPage>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedPage>
            <SupportPage />
          </ProtectedPage>
        }
      />
      <Route
        path="/workspace/settings"
        element={
          <AdminPage>
            <WorkspaceSettingsPage />
          </AdminPage>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedPage>
            <ProfilePage />
          </ProtectedPage>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedPage>
            <SettingsPage />
          </ProtectedPage>
        }
      />
      <Route
        path="/settings/personal/profile"
        element={
          <ProtectedPage layout="settings">
            <PersonalProfilePage />
          </ProtectedPage>
        }
      />
      <Route
        path="/settings/personal/vault-key"
        element={
          <ProtectedPage layout="settings">
            <VaultKeyPage />
          </ProtectedPage>
        }
      />
      <Route
        path="/settings/key-reset"
        element={
          <ProtectedPage layout="none">
            <KeyResetPage />
          </ProtectedPage>
        }
      />
      <Route
        path="/settings/admin/workspace"
        element={
          <AdminPage layout="settings">
            <WorkspaceDetailsPage />
          </AdminPage>
        }
      />
      <Route
        path="/settings/admin/audit"
        element={
          <AdminPage layout="settings">
            <AuditSettingsPage />
          </AdminPage>
        }
      />
      <Route
        path="/settings/admin/requests"
        element={
          <AdminPage layout="settings">
            <AccessRequestsPage />
          </AdminPage>
        }
      />
      <Route
        path="/share-feedback"
        element={
          <ProtectedPage>
            <ShareFeedbackPage />
          </ProtectedPage>
        }
      />
      <Route
        path="/workbench/:accountId"
        element={
          <ProtectedPage layout="none" requiresVault>
            <Suspense fallback={<LoadingSpinner message="Loading workbench..." />}>
              <WorkbenchPage />
            </Suspense>
          </ProtectedPage>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthErrorProvider>
        <AppProvider config={appConfig}>
          <VaultProvider>
            <ThemeProvider defaultTheme="dark" storageKey="vaultsql-theme">
              <Toaster position="top-right" richColors />
              <BrowserRouter>
                <HelpScoutBeacon />
                <AppLoadingGate>
                  <AppRoutes />
                </AppLoadingGate>
              </BrowserRouter>
            </ThemeProvider>
          </VaultProvider>
        </AppProvider>
      </AuthErrorProvider>
    </QueryClientProvider>
  )
}

export default App
