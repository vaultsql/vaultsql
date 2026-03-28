import type { Client } from 'openapi-fetch'
import type { paths } from '@/lib/openapi'
import {
  createBaseWorkbenchBackend,
  type GetToken,
} from '@/workbench/lib/backends/BaseRemoteBackend'
import type { WorkbenchBackend } from '@/workbench/types/database'

export function createWebWorkbenchBackend(
  accountId: string,
  databaseType: 'postgres' | 'mysql',
  client: Client<paths>,
  getToken: GetToken,
  passphrase?: string,
): WorkbenchBackend {
  return createBaseWorkbenchBackend(
    {
      storagePrefix: 'vaultsql:web:',
      databaseName: 'VaultSQL',
      databaseType,
      fetchFn: fetch,
    },
    accountId,
    client,
    getToken,
    passphrase,
  )
}
