import { useMutation } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'

interface LoginCredentials {
  email: string
  password: string
}

interface SignupCredentials {
  email: string
  password: string
  name: string
}

/**
 * Wraps an API call to handle network errors and non-JSON responses gracefully.
 * Returns the error message from the response, or a generic message if unavailable.
 */
async function safeAuthCall<T>(
  apiCall: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  try {
    const result = await apiCall()
    if (result.data) return result.data
    throw new Error(getErrorMessage(result.error))
  } catch (err) {
    // Re-throw if already an Error with a good message
    if (err instanceof Error) {
      throw err
    }
    // Catch network errors or unexpected failures
    throw new Error(getErrorMessage(err))
  }
}

export function useLogin() {
  const { noAuthClient } = useAppContext()

  return useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      safeAuthCall(() =>
        noAuthClient.POST('/api/auth/login', {
          body: credentials,
        }),
      ),
  })
}

export function useSignup() {
  const { noAuthClient } = useAppContext()

  return useMutation({
    mutationFn: (credentials: SignupCredentials) =>
      safeAuthCall(() =>
        noAuthClient.POST('/api/auth/signup', {
          body: credentials,
        }),
      ),
  })
}

interface RequestLoginCodeData {
  email: string
}

interface VerifyLoginCodeData {
  email: string
  code: string
}

export function useRequestLoginCode() {
  const { noAuthClient } = useAppContext()

  return useMutation({
    mutationFn: (data: RequestLoginCodeData) =>
      safeAuthCall(() =>
        noAuthClient.POST('/api/auth/request-code', {
          body: data,
        }),
      ),
  })
}

export function useVerifyLoginCode() {
  const { noAuthClient } = useAppContext()

  return useMutation({
    mutationFn: (data: VerifyLoginCodeData) =>
      safeAuthCall(() =>
        noAuthClient.POST('/api/auth/verify-code', {
          body: data,
        }),
      ),
  })
}

export function useDevLogin() {
  const { noAuthClient } = useAppContext()

  return useMutation({
    mutationFn: (suffix?: string) =>
      safeAuthCall(() =>
        noAuthClient.POST(suffix ? `/api/auth/devlogin/${suffix}` : '/api/auth/devlogin', {}),
      ),
  })
}
