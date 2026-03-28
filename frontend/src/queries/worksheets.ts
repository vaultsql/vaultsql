import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppClient } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type Folder = components['schemas']['FolderResponse']
export type FolderCreateRequest = components['schemas']['FolderCreateRequest']
export type FolderUpdateRequest = components['schemas']['FolderUpdateRequest']

export type Worksheet = components['schemas']['WorksheetResponse']
export type WorksheetCreateRequest = components['schemas']['WorksheetCreateRequest']
export type WorksheetUpdateRequest = components['schemas']['WorksheetUpdateRequest']

// ============ Folder Hooks ============

export function useFolders(databaseId: string) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['folders', databaseId],
    enabled: Boolean(databaseId),
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/workbench/folders', {
        params: { query: { server_id: databaseId } },
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

type CreateFolderPayload = {
  name: string
  position?: number | null
}

export function useCreateFolder(databaseId: string) {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateFolderPayload) => {
      const { data, error } = await client.POST('/api/workbench/folders', {
        body: {
          server_id: databaseId,
          name: payload.name,
          position: payload.position,
        },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders', databaseId] })
    },
  })
}

export function useUpdateFolder(databaseId: string) {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      folderId,
      payload,
    }: {
      folderId: string
      payload: FolderUpdateRequest
    }) => {
      const { data, error } = await client.PATCH('/api/workbench/folders/{folder_id}', {
        params: { path: { folder_id: folderId } },
        body: payload,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders', databaseId] })
    },
  })
}

export function useDeleteFolder(databaseId: string) {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (folderId: string) => {
      const { data, error } = await client.DELETE('/api/workbench/folders/{folder_id}', {
        params: { path: { folder_id: folderId } },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders', databaseId] })
      queryClient.invalidateQueries({ queryKey: ['worksheets', databaseId] })
    },
  })
}

// ============ Worksheet Hooks ============

export function useWorksheets(databaseId: string) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['worksheets', databaseId],
    enabled: Boolean(databaseId),
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/workbench/worksheets', {
        params: { query: { server_id: databaseId } },
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useWorksheet(worksheetId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['worksheet', worksheetId],
    enabled: Boolean(worksheetId) && enabled,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/workbench/worksheets/{worksheet_id}', {
        params: { path: { worksheet_id: worksheetId } },
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

type CreateWorksheetPayload = {
  name: string
  content?: string
  folder_id?: string | null
  position?: number | null
}

export function useCreateWorksheet(databaseId: string) {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateWorksheetPayload) => {
      const { data, error } = await client.POST('/api/workbench/worksheets', {
        body: {
          server_id: databaseId,
          name: payload.name,
          content: payload.content ?? '',
          folder_id: payload.folder_id,
          position: payload.position,
        },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets', databaseId] })
    },
  })
}

export function useUpdateWorksheet(databaseId: string) {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      worksheetId,
      payload,
    }: {
      worksheetId: string
      payload: WorksheetUpdateRequest
    }) => {
      const { data, error } = await client.PATCH('/api/workbench/worksheets/{worksheet_id}', {
        params: { path: { worksheet_id: worksheetId } },
        body: payload,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worksheets', databaseId] })
      queryClient.invalidateQueries({ queryKey: ['worksheet', variables.worksheetId] })
    },
  })
}

export function useDeleteWorksheet(databaseId: string) {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (worksheetId: string) => {
      const { data, error } = await client.DELETE('/api/workbench/worksheets/{worksheet_id}', {
        params: { path: { worksheet_id: worksheetId } },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets', databaseId] })
    },
  })
}
