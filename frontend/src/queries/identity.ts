import { useMutation, useQuery } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type IdentityWorkspace = {
  id: string
  name: string
  slug: string
  role: string | null
  mode: string
}

export type IdentityInfo = {
  id: string
  email: string
  name: string
}

type AuthResponse = components['schemas']['AuthResponse']

export function useIdentityMe() {
  const { client } = useAppContext()
  // TODO: tighten typing once openapi schema includes identity endpoints

  const identityClient = client as any

  return useQuery({
    queryKey: ['identity-me'],
    queryFn: async ({ signal }) => {
      const { data, error } = await identityClient.GET('/api/identity/me', {
        signal,
      })
      if (data) return data.identity as IdentityInfo
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useIdentityWorkspaces({ join = false }: { join?: boolean } = {}) {
  const { client } = useAppContext()
  // TODO: tighten typing once openapi schema includes identity endpoints

  const identityClient = client as any

  return useQuery({
    queryKey: ['identity-workspaces', join ? 'join' : 'member'],
    queryFn: async ({ signal }) => {
      const { data, error } = await identityClient.GET('/api/identity/workspace', {
        signal,
        params: { query: join ? { join: true } : {} },
      })
      if (data) return data as IdentityWorkspace[]
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useIdentityWorkspaceLogin() {
  const { client } = useAppContext()
  // TODO: tighten typing once openapi schema includes identity endpoints

  const identityClient = client as any

  return useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      const { data, error } = await identityClient.POST(
        '/api/identity/workspace/{workspace_id}/login',
        {
          params: { path: { workspace_id: workspaceId } },
        },
      )
      if (data) return data as AuthResponse
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useCreateWorkspace() {
  const { client } = useAppContext()
  // TODO: tighten typing once openapi schema includes identity endpoints

  const identityClient = client as any

  return useMutation({
    mutationFn: async ({
      name,
      slug,
      mode,
      userName,
      referrer,
    }: {
      name: string
      slug?: string
      mode: string
      userName: string
      referrer?: string | null
    }) => {
      const { data, error } = await identityClient.POST('/api/identity/workspace', {
        body: { name, slug, mode, user_name: userName, referrer },
      })
      if (data) return data as AuthResponse
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useIdentityWorkspacesWithInvite({ inviteCode }: { inviteCode: string }) {
  const { client } = useAppContext()
  // TODO: tighten typing once openapi schema includes identity endpoints

  const identityClient = client as any

  return useQuery({
    queryKey: ['identity-workspaces', 'invite', inviteCode],
    queryFn: async ({ signal }) => {
      const { data, error } = await identityClient.GET('/api/identity/workspace', {
        signal,
        params: { query: { invite_code: inviteCode } },
      })
      if (data) return data as IdentityWorkspace[]
      throw new Error(getErrorMessage(error))
    },
    enabled: !!inviteCode,
  })
}

export function useJoinWorkspace() {
  const { client } = useAppContext()
  // TODO: tighten typing once openapi schema includes identity endpoints

  const identityClient = client as any

  return useMutation({
    mutationFn: async ({
      workspaceId,
      inviteCode,
      userName,
    }: {
      workspaceId: string
      inviteCode?: string | null
      userName: string
    }) => {
      const { data, error } = await identityClient.POST(
        '/api/identity/workspace/{workspace_id}/join',
        {
          params: {
            path: { workspace_id: workspaceId },
            query: inviteCode ? { invite_code: inviteCode } : {},
          },
          body: { user_name: userName },
        },
      )
      if (data) return data as AuthResponse
      throw new Error(getErrorMessage(error))
    },
  })
}
