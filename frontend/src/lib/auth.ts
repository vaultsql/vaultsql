import { emitAuthTokenChanged } from './auth-events'

export const AUTH_TOKEN_STORAGE_KEY = 'vaultsql_token'

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  emitAuthTokenChanged()
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  emitAuthTokenChanged()
}
