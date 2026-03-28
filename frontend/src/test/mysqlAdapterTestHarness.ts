import { afterAll, beforeAll } from 'vitest'
import { mysqlAdapterFactory } from '@/workbench/lib/databases/mysql'
import type { DatabaseAdapter, DatabaseInfo } from '@/workbench/types/database'
import {
  connectTestDb,
  createMySQLRunQueryFn,
  disconnectTestDb,
  isDbConnected,
  loadFixtures,
} from './mysqlTestClient'

function setupMySQLAdapter() {
  let adapter: DatabaseAdapter | null = null

  beforeAll(async () => {
    const connected = await connectTestDb()
    if (connected) {
      await loadFixtures()
      const runQuery = createMySQLRunQueryFn()
      const dbInfo: DatabaseInfo = {
        name: 'mysql_demo',
        type: 'mysql',
        schema: 'test_schema',
      }
      adapter = mysqlAdapterFactory(runQuery, dbInfo)
    }
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  const getAdapter = () => adapter

  const getAdapterOrThrow = () => {
    if (!adapter) {
      throw new Error('MySQL adapter not initialized')
    }
    return adapter
  }

  const skipIfNoDb = () => {
    if (!isDbConnected()) {
      console.warn('Skipping: database not available')
      return true
    }
    return false
  }

  return { getAdapter, getAdapterOrThrow, skipIfNoDb }
}

export { setupMySQLAdapter }
