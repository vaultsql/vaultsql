import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppClient } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type Group = components['schemas']['UserGroupResponse']
export type User = components['schemas']['WorkspaceMemberResponse']
export type GroupWithMembers = Group & { members: User[] }

export function useGroups() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['groups'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/group/groups', {
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useGroupsWithMembers() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['groups', 'members'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/group/groups', {
        signal,
        params: {
          query: { members: true },
        },
      })
      if (data) return data as GroupWithMembers[]
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useUsers() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['users'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/group/users', {
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useAddMember() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { data, error } = await client.POST('/api/group/groups/{group_id}/members', {
        params: { path: { group_id: groupId } },
        body: { user_id: userId },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'members'] })
    },
  })
}

export function useRemoveMember() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { data, error } = await client.DELETE(
        '/api/group/groups/{group_id}/members/{user_id}',
        {
          params: { path: { group_id: groupId, user_id: userId } },
        },
      )
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'members'] })
    },
  })
}

export function useCreateGroup() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data, error } = await client.POST('/api/group/groups', {
        body: { name, description },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'members'] })
    },
  })
}

export function useUpdateGroup() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupId,
      name,
      description,
    }: {
      groupId: string
      name: string
      description?: string
    }) => {
      const { data, error } = await client.PUT('/api/group/groups/{group_id}', {
        params: { path: { group_id: groupId } },
        body: { name, description },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'members'] })
    },
  })
}

export function useDeleteGroup() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ groupId }: { groupId: string }) => {
      const { data, error } = await client.DELETE('/api/group/groups/{group_id}', {
        params: { path: { group_id: groupId } },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'members'] })
    },
  })
}

export function useUpdateUserRole() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await client.PUT('/api/group/users/{user_id}/role', {
        params: { path: { user_id: userId } },
        body: { role },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useRemoveUser() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data, error } = await client.DELETE('/api/group/users/{user_id}', {
        params: { path: { user_id: userId } },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'members'] })
    },
  })
}
