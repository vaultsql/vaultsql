import { Pool, type PoolClient, types } from 'pg'
import type { QueryResponse, RunQueryFn } from '@/workbench/types/database'
import { POSTGRES_SETUP_SQL, POSTGRES_TEST_CONFIG } from './fixtures/postgres'

// Configure pg to parse PostgreSQL arrays as JavaScript arrays
const parseArray = (val: string) => {
  if (!val) return []
  // Parse PostgreSQL array format: {elem1,elem2,...}
  return val.slice(1, -1).split(',').filter(Boolean)
}

types.setTypeParser(1009 as any, parseArray) // text[]

types.setTypeParser(1003 as any, parseArray) // name[]

let pool: Pool | null = null
let client: PoolClient | null = null
let fixturesLoaded = false

/**
 * Connect to the test database.
 * Returns true if connection succeeded, false otherwise.
 */
export async function connectTestDb(): Promise<boolean> {
  try {
    pool = new Pool({
      ...POSTGRES_TEST_CONFIG,
      connectionTimeoutMillis: 3000,
      max: 1,
    })
    client = await pool.connect()
    return true
  } catch (error) {
    console.warn('Test database not available, tests will be skipped:', error)
    return false
  }
}

/**
 * Disconnect from the test database.
 */
export async function disconnectTestDb(): Promise<void> {
  if (client) {
    client.release()
    client = null
  }
  if (pool) {
    await pool.end()
    pool = null
  }
  fixturesLoaded = false
}

/**
 * Load test fixtures (idempotent - safe to call multiple times).
 * Creates test_schema with sample tables and data.
 */
export async function loadFixtures(): Promise<void> {
  if (!client) {
    throw new Error('Database not connected. Call connectTestDb() first.')
  }

  if (fixturesLoaded) {
    return
  }

  try {
    await client.query(POSTGRES_SETUP_SQL)
    fixturesLoaded = true
  } catch (error) {
    console.error('Failed to load test fixtures:', error)
    throw error
  }
}

/**
 * Create a RunQueryFn backed by the test database connection.
 */
export function createPgRunQueryFn(): RunQueryFn {
  return async (sql: string): Promise<QueryResponse> => {
    if (!client) {
      throw new Error('Database not connected. Call connectTestDb() first.')
    }

    try {
      const result = await client.query(sql)
      return {
        success: true,
        result: result.rows,
        columns: result.fields?.map((f) => ({ name: f.name, type: f.dataTypeID.toString() })),
        error: null,
      }
    } catch (error) {
      return {
        success: false,
        result: null,
        columns: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

/**
 * Check if database is connected.
 */
export function isDbConnected(): boolean {
  return client !== null
}

/**
 * Get the test configuration (for reference in tests).
 */
export { POSTGRES_TEST_CONFIG }
