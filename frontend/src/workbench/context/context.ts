import { createContext } from 'react'

import type { HistoryItem, WorkbenchBackend } from '@/workbench/types/database'
import type { StarredStoreApi } from '../features/starred'
import type { DatabaseService } from '../lib/DatabaseService'
import type { WorkbenchPermissions } from './permissions'

export type WorkbenchMode = 'READ_ONLY' | 'READ_WRITE'

export type WorkbenchContextValue = {
  db: DatabaseService
  databaseId: string
  accountId: string
  accountName: string
  databaseName: string
  databaseType: string
  mode: WorkbenchMode
  permissions: WorkbenchPermissions
  history: HistoryItem[]
  clearHistory: () => Promise<void>
  backend: WorkbenchBackend
  starredStore: StarredStoreApi
}

export const WorkbenchContext = createContext<WorkbenchContextValue | undefined>(undefined)
