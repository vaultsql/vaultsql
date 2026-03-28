export const AUTH_TOKEN_CHANGED_EVENT = 'vaultsql:auth-token-changed'

export function emitAuthTokenChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT))
}

export function subscribeAuthTokenChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handler)
  return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handler)
}
