import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppClient } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type CreateKeyResponse = components['schemas']['CreateKeyResponse']
export type UserKey = components['schemas']['UserKeyResponse']

export function useCreateKey() {
  const client = useAppClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await client.POST('/api/keys/create', {})
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    // Don't auto-invalidate - let the component control when to refetch
  })
}

export function usePendingKeys() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['keys', 'pending'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/keys/pending', { signal })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useMyKeys({ enabled = true }: { enabled?: boolean } = {}) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['keys', 'me'],
    enabled,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/keys/me', { signal })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useActivateKey() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ keyId, passphrase }: { keyId: string; passphrase: string }) => {
      const { data, error } = await client.POST('/api/keys/activate', {
        body: {
          key_id: keyId,
          admin_passphrase: passphrase,
        },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys', 'pending'] })
    },
  })
}

export function useRevokeKey() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (keyId: string) => {
      const { data, error } = await client.POST('/api/keys/revoke', {
        body: { key_id: keyId },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['keys', 'all'] })
    },
  })
}

export function useConfirmKey() {
  const client = useAppClient()

  return useMutation({
    mutationFn: async (keyId: string) => {
      const { data, error } = await client.POST('/api/keys/confirm', {
        body: { key_id: keyId },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useInvalidateUser() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['me'] })
  }
}
