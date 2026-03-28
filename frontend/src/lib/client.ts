import { atom } from 'nanostores'
import { getAuthToken } from '@/lib/auth'

// Reactive auth token state for webapp components that need to react to auth changes
// (e.g., triggering re-renders on login/logout)
export const authToken = atom<string | undefined>()

const token = getAuthToken()
if (token) {
  authToken.set(token)
}
