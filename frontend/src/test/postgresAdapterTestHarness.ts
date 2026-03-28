import { afterAll, beforeAll } from 'vitest'
import { postgresAdapterFactory } from '@/workbench/lib/databases/postgres'
import type { DatabaseAdapter, DatabaseInfo } from '@/workbench/types/database'
import {
  connectTestDb,
  createPgRunQueryFn,
  disconnectTestDb,
  isDbConnected,
  loadFixtures,
} from './pgTestClient'

function setupPostgresAdapter() {
  let adapter: DatabaseAdapter | null = null

  beforeAll(async () => {
    const connected = await connectTestDb()
    if (connected) {
      await loadFixtures()
      const runQuery = createPgRunQueryFn()
      const dbInfo: DatabaseInfo = {
        name: 'demodb',
        type: 'postgres',
        schema: 'test_schema',
      }
      adapter = postgresAdapterFactory(runQuery, dbInfo)
    }
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  const getAdapter = () => adapter

  const getAdapterOrThrow = () => {
    if (!adapter) {
      throw new Error('Postgres adapter not initialized')
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

export { setupPostgresAdapter }
