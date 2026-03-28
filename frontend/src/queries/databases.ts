import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppClient, useAppContext } from '@/lib/app-context'
import { getErrorMessage } from '@/lib/errors'
import type { components } from '@/lib/openapi'

export type WorkbenchAccount = {
  account_id: string
  account_name: string
  database_id: string
  database_name: string
  database_type: string
  access_level: string
  environment: string | null
}

export type Database = components['schemas']['DatabaseResponse']
export type DatabaseCreateWizardRequest = components['schemas']['DatabaseCreateWizardRequest']
export type DatabaseUpdateRequest = components['schemas']['DatabaseUpdateRequest']
export type Account = components['schemas']['AccountResponse']
export type AccountUpdateRequest = components['schemas']['AccountUpdateRequest']
export type AccountCreateWizardRequest = components['schemas']['AccountCreateWizardRequest']

export function useDatabases() {
  const client = useAppClient()

  return useQuery({
    queryKey: ['databases'],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/database/', {
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useDatabase(databaseId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['database', databaseId],
    enabled: Boolean(databaseId) && enabled,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/database/{database_id}', {
        params: { path: { database_id: databaseId } },
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useCreateDatabase() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: DatabaseCreateWizardRequest) => {
      const { data, error } = await client.POST('/api/database/create', {
        body: payload,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useUpdateDatabase() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      databaseId,
      payload,
    }: {
      databaseId: string
      payload: DatabaseUpdateRequest
    }) => {
      const { data, error } = await client.PATCH('/api/database/{database_id}', {
        params: { path: { database_id: databaseId } },
        body: payload,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
      queryClient.invalidateQueries({ queryKey: ['database', variables.databaseId] })
    },
  })
}

export function useDatabaseAccounts(
  databaseId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const client = useAppClient()

  return useQuery({
    queryKey: ['database-accounts', databaseId],
    enabled: Boolean(databaseId) && enabled,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.GET('/api/database/{database_id}/accounts', {
        params: { path: { database_id: databaseId } },
        signal,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
  })
}

export function useUpdateAccount() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      databaseId,
      accountId,
      payload,
    }: {
      databaseId: string
      accountId: string
      payload: AccountUpdateRequest
    }) => {
      const { data, error } = await client.PATCH(
        '/api/database/{database_id}/accounts/{account_id}',
        {
          params: { path: { database_id: databaseId, account_id: accountId } },
          body: payload,
        },
      )
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database-accounts', variables.databaseId] })
    },
  })
}

export function useCreateAccountWizard() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      databaseId,
      payload,
    }: {
      databaseId: string
      payload: AccountCreateWizardRequest
    }) => {
      const { data, error } = await client.POST('/api/database/{database_id}/account/create', {
        params: { path: { database_id: databaseId } },
        body: payload,
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['database-accounts', variables.databaseId] })
    },
  })
}

export function useWorkbenchAccount(
  accountId: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { client, getToken } = useAppContext()

  return useQuery({
    queryKey: ['workbench-account', accountId],
    enabled: Boolean(accountId) && enabled,
    queryFn: async ({ signal }) => {
      // Use client's internal fetch with auth headers
      const token = await getToken()
      const baseUrl = (client as unknown as { baseUrl: string }).baseUrl || ''
      const response = await fetch(`${baseUrl}/api/account/${accountId}`, {
        signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          (errorData as { detail?: string }).detail || `Failed to load account: ${response.status}`,
        )
      }

      return response.json() as Promise<WorkbenchAccount>
    },
  })
}

export function useSetupDemoDatabases() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (passphrase?: string) => {
      const { data, error } = await client.POST('/api/database/demo/setup', {
        body: { passphrase: passphrase ?? null },
      })
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useClearDemoDatabases() {
  const client = useAppClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await client.DELETE('/api/database/demo/clear')
      if (data) return data
      throw new Error(getErrorMessage(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}
