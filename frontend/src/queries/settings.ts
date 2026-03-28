import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAppClient, useAppContext } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'

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

export interface WorkspaceSettings {
  audit_enabled: boolean
  audit_store_queries: boolean
  allowed_email_domains: string[]
  workspace_name: string
  admin_email_domain: string | null
  is_free_email_domain: boolean
}

export function useWorkspaceSettings() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['workspace-settings'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/settings/', {
        signal,
      })
      if (data) return data as WorkspaceSettings
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useUpdateWorkspaceSettings() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Partial<WorkspaceSettings>) => {
      const { data, error } = await client.PATCH('/api/settings/', {
        body: settings,
      })
      if (data) return data as WorkspaceSettings
      throw new Error(getErrorMessage(error))
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['workspace-settings'], data)
    },
    onError: (error) => {
      toast.error(error.message || 'Something went wrong')
    },
  })
}

export function useUploadWorkspaceImage() {
  const { baseUrl, authFetch } = useAppContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file, file.name)

      const response = await authFetch(buildApiUrl(baseUrl, '/api/workspace/image'), {
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
      // Invalidate user query to refetch with new workspace image URL
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (error) => {
      toast.error(error.message || 'Something went wrong')
    },
  })
}

export interface AuditLogEntry {
  id: string
  created_at: string
  actor_type: string
  actor_email: string | null
  event_type: string
  server_name: string | null
  query_actor_type: string | null
  database: string | null
  metadata: Record<string, unknown>
}

export interface AuditLogListResponse {
  items: AuditLogEntry[]
  total: number
  page: number
  page_size: number
}

export function useAuditLogs(categories: string[], page = 1, pageSize = 50) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['audit-logs', categories.join(','), page, pageSize],
    queryFn: async ({ signal }) => {
      const categoriesParam = categories.length > 0 ? categories.join(',') : undefined
      const { data, error } = await client.GET('/api/audit/audit-log', {
        signal,
        params: {
          query: {
            categories: categoriesParam,
            page,
            page_size: pageSize,
          },
        },
      })
      if (data) return data as AuditLogListResponse
      throw new Error(getErrorMessage(error))
    },
    enabled: categories.length > 0, // Skip query if no categories selected
  })
}
