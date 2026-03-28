import { useMutation } from '@tanstack/react-query'
import { useAppClient } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type WorkspaceInvitation = components['schemas']['WorkspaceInvitationResponse']

export function useWorkspaceInvite(force: boolean = false) {
  const client = useAppClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await client.POST('/api/workspace/invite', {
        params: {
          query: force ? { force: true } : {},
        },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}
