import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppClient, useAppContext } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import { buildUserQueryOptions, isUserAdmin, userQueryKey } from '@/queries/user-query'

function buildApiUrl(baseUrl: string, path: string) {
  if (!baseUrl || baseUrl === '/') return path
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function parseResponseBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function useUser({ enabled = true }: { enabled?: boolean } = {}) {
  const client = useAppClient()
  const { isAuthLoading, sessionType } = useAppContext()
  const shouldEnable = enabled && (isAuthLoading || sessionType === 'workspace')

  return useQuery({
    enabled: shouldEnable,
    ...buildUserQueryOptions(client),
  })
}

/**
 * Hook to check if the current user is an admin
 */
export function useIsAdmin(): boolean {
  const { data: user } = useUser()
  return isUserAdmin(user)
}

export function useLogout() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await client.POST('/api/user/logout')
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      // Clear all cached queries on logout
      queryClient.clear()
    },
  })
}

export function useTestPassphrase() {
  const client = useAppClient()

  return useMutation({
    mutationFn: async (passphrase: string) => {
      const { data, error } = await client.POST('/api/user/test-passphrase', {
        body: { passphrase },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useAccountKeys() {
  const client = useAppClient()

  return useMutation({
    mutationFn: async ({ accountId, passphrase }: { accountId: string; passphrase: string }) => {
      const { data, error } = await client.POST('/api/account/{account_id}/keys', {
        params: { path: { account_id: accountId } },
        body: { passphrase },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useMarkNotificationsRead() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await client.POST('/api/user/notified', {})
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      // Invalidate queries to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: userQueryKey })
    },
  })
}

export function useUpdateProfile() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profile: { name?: string }) => {
      const { data, error } = await client.PATCH('/api/user/me', {
        body: profile,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: (data) => {
      // Update the user query cache with the new data
      queryClient.setQueryData(userQueryKey, data)
    },
  })
}

export function useUploadAvatar() {
  const { baseUrl, authFetch } = useAppContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file, file.name)

      const response = await authFetch(buildApiUrl(baseUrl, '/api/user/avatar'), {
        method: 'POST',
        body: formData,
      })
      const responseText = await response.text()
      const parsed = parseResponseBody(responseText)

      if (!response.ok) {
        throw new Error(getErrorMessage(parsed || response.statusText))
      }
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Unexpected response from server.')
      }
      return parsed
    },
    onSuccess: () => {
      // Invalidate user query to refetch with new image URL
      queryClient.invalidateQueries({ queryKey: userQueryKey })
    },
  })
}
