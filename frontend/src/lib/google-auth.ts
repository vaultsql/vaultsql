import { getErrorMessage } from '@/lib/errors'

const STATE_KEY = 'vaultsql_google_oauth_state'
const REDIRECT_KEY = 'vaultsql_google_oauth_redirect'
const INVITE_KEY = 'vaultsql_google_oauth_invite'

type GoogleAuthStartResponse = {
  auth_url: string
  state: string
}

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl && envUrl !== '/') return envUrl
  return window.location.origin
}

export function getGoogleRedirectUri(): string {
  return `${window.location.origin}/auth/complete/google`
}

export function setGoogleAuthContext({
  state,
  redirect,
  inviteCode,
}: {
  state: string
  redirect?: string | null
  inviteCode?: string | null
}): void {
  sessionStorage.setItem(STATE_KEY, state)
  if (redirect) {
    sessionStorage.setItem(REDIRECT_KEY, redirect)
  } else {
    sessionStorage.removeItem(REDIRECT_KEY)
  }
  if (inviteCode) {
    sessionStorage.setItem(INVITE_KEY, inviteCode)
  } else {
    sessionStorage.removeItem(INVITE_KEY)
  }
}

export function getGoogleAuthContext(): {
  state: string | null
  redirect: string | null
  inviteCode: string | null
} {
  return {
    state: sessionStorage.getItem(STATE_KEY),
    redirect: sessionStorage.getItem(REDIRECT_KEY),
    inviteCode: sessionStorage.getItem(INVITE_KEY),
  }
}

export function clearGoogleAuthContext(): void {
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(REDIRECT_KEY)
  sessionStorage.removeItem(INVITE_KEY)
}

export async function startGoogleAuth({
  redirect,
  inviteCode,
}: {
  redirect?: string | null
  inviteCode?: string | null
}): Promise<void> {
  const baseUrl = getApiBaseUrl()
  const redirectUri = getGoogleRedirectUri()
  const url = new URL('/api/auth/google/start', baseUrl)
  url.searchParams.set('redirect_uri', redirectUri)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    let errorDetail: unknown = null
    try {
      errorDetail = await response.json()
    } catch {
      errorDetail = response.statusText
    }
    throw new Error(getErrorMessage(errorDetail))
  }

  const payload = (await response.json()) as GoogleAuthStartResponse
  if (!payload.auth_url || !payload.state) {
    throw new Error('Invalid Google OAuth response')
  }

  setGoogleAuthContext({ state: payload.state, redirect, inviteCode })
  window.location.assign(payload.auth_url)
}

export async function completeGoogleAuth(code: string, state: string) {
  const baseUrl = getApiBaseUrl()
  const url = new URL('/api/auth/google/complete', baseUrl)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, state }),
  })

  if (!response.ok) {
    let errorDetail: unknown = null
    try {
      errorDetail = await response.json()
    } catch {
      errorDetail = response.statusText
    }
    throw new Error(getErrorMessage(errorDetail))
  }

  return response.json() as Promise<{
    token: string
    needs_onboarding: boolean
  }>
}
