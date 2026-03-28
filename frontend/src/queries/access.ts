import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppClient } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type Access = components['schemas']['AccessResponse']
export type AccessGrantRequest = components['schemas']['AccessGrantRequest']
export type AccessRequestRequest = components['schemas']['AccessRequestRequest']
export type PendingAccessRequest = components['schemas']['PendingAccessRequestResponse']
export type AccessRequestHistory = components['schemas']['AccessRequestHistoryResponse']

export function useUserAccounts() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['user-accounts'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/access/user/{user_id}', {
        params: {
          path: {
            user_id: 'me',
          },
        },
        signal,
      })

      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useAccountAccess(
  databaseId: string,
  accountId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['account-access', databaseId, accountId],
    enabled: Boolean(databaseId) && Boolean(accountId) && enabled,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/access/account/{database_id}/{account_id}', {
        params: { path: { database_id: databaseId, account_id: accountId } },
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useGrantAccess() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: AccessGrantRequest) => {
      const { data, error } = await client.POST('/api/access/grant', {
        body: payload,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({
        queryKey: ['account-access', payload.database_id, payload.account_id],
      })
    },
  })
}

export function useRequestAccess() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: AccessRequestRequest) => {
      const { data, error } = await client.POST('/api/access/request', {
        body: payload,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['user-accounts'],
      })
    },
  })
}

export function usePendingAccessRequests() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['pending-access-requests'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/access/pending', {
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useApproveAccess() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (accessId: string) => {
      const { data, error } = await client.POST('/api/access/approve', {
        body: { access_id: accessId },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['pending-access-requests'],
      })
    },
  })
}

export function useDenyAccess() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (accessId: string) => {
      const { data, error } = await client.POST('/api/access/deny', {
        body: { access_id: accessId },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['pending-access-requests'],
      })
    },
  })
}

export function useAccessRequestHistory() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['access-request-history'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/access/history', {
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

/**
 * Check if an access grant is currently active
 */
export function isAccessActive(access: Access): boolean {
  // Not active if revoked or denied
  if (access.revoked_at || access.denied_at) return false

  // Not active if not yet granted (pending request)
  if (!access.granted_at) return false

  // Check expiry
  if (access.granted_until) {
    const expiresAt = new Date(access.granted_until)
    if (expiresAt < new Date()) return false
  }

  return true
}

/**
 * Check if an access is a pending request (not yet approved/denied)
 */
export function isAccessPending(access: Access): boolean {
  return (
    Boolean(access.requested_at) && !access.granted_at && !access.denied_at && !access.revoked_at
  )
}
