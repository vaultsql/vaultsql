import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getAuthToken } from '@/lib/auth'
import { usePageTitle } from '@/webapp/hooks'

type PageState = 'checking' | 'no_port' | 'not_logged_in' | 'redirecting' | 'success'

export function DesktopLoginPage() {
  usePageTitle('Desktop Login')
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<PageState>('checking')

  const port = searchParams.get('port')

  useEffect(() => {
    if (!port) {
      setState('no_port')
      return
    }

    const token = getAuthToken()
    if (!token) {
      setState('not_logged_in')
      return
    }

    // Redirect to localhost callback with token
    setState('redirecting')
    const callbackUrl = `http://127.0.0.1:${port}/callback?token=${encodeURIComponent(token)}`
    window.location.href = callbackUrl
    setState('success')
  }, [port])

  if (state === 'checking' || state === 'redirecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold">VaultSQL Desktop</h2>
          <p className="mt-2 text-muted-foreground">
            {state === 'checking' ? 'Checking authentication...' : 'Redirecting to desktop app...'}
          </p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-600">Success!</h2>
          <p className="mt-2 text-muted-foreground">
            You can close this tab and return to the VaultSQL desktop app.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'no_port') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center p-8">
          <h2 className="text-2xl font-bold text-destructive">Invalid Request</h2>
          <p className="mt-2 text-muted-foreground">
            This page should be opened from the VaultSQL desktop app. Missing callback port
            parameter.
          </p>
        </div>
      </div>
    )
  }

  // not_logged_in
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md text-center p-8 space-y-4">
        <h2 className="text-2xl font-bold">Login Required</h2>
        <p className="text-muted-foreground">
          You need to be logged into VaultSQL before connecting the desktop app.
        </p>
        <p className="text-sm text-muted-foreground">
          Note: This is a temporary simplification. Future versions will support SSO and direct
          login from the desktop app.
        </p>
        <div className="pt-4">
          <Link
            to={`/login?redirect=${encodeURIComponent(`/auth/desktop?port=${port}`)}`}
            className="inline-block py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Sign in to VaultSQL
          </Link>
        </div>
      </div>
    </div>
  )
}
