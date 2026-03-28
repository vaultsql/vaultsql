import type { Client } from 'openapi-fetch'
import { getErrorMessage } from '@/lib/errors'
import type { paths } from '@/lib/openapi'

export type ApiError = Error & {
  status?: number
  cause?: unknown
}

export const userQueryKey = ['me'] as const

export function toApiError(error: unknown, response?: Response): ApiError {
  const apiError = new Error(getErrorMessage(error)) as ApiError
  apiError.status = response?.status
  apiError.cause = error
  return apiError
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

export function buildUserQueryOptions(client: Client<paths>) {
  return {
    queryKey: userQueryKey,
    staleTime: 10 * 60 * 1000, // 10 minutes - user data rarely changes
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const { data, error, response } = await client.GET('/api/user/me', {
        signal,
      })
      if (data) return data
      throw toApiError(error, response)
    },
  }
}

/**
 * Check if the user has admin role in their workspace
 */
export function isUserAdmin(user: { workspace?: { role?: string } } | undefined | null): boolean {
  return user?.workspace?.role === 'admin'
}
