import type { Connection } from 'mysql2/promise'
import mysql from 'mysql2/promise'
import type { QueryResponse, RunQueryFn } from '@/workbench/types/database'
import { MYSQL_SETUP_SQL, MYSQL_TEST_CONFIG } from './fixtures/mysql'

let connection: Connection | null = null
let fixturesLoaded = false

/**
 * Connect to the test database.
 * Returns true if connection succeeded, false otherwise.
 */
export async function connectTestDb(): Promise<boolean> {
  try {
    connection = await mysql.createConnection({
      ...MYSQL_TEST_CONFIG,
      multipleStatements: true,
      connectTimeout: 3000,
    })
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
  if (connection) {
    await connection.end()
    connection = null
  }
  fixturesLoaded = false
}

/**
 * Load test fixtures (idempotent - safe to call multiple times).
 * Creates test_schema database with sample tables and data.
 */
export async function loadFixtures(): Promise<void> {
  if (!connection) {
    throw new Error('Database not connected. Call connectTestDb() first.')
  }

  if (fixturesLoaded) {
    return
  }

  try {
    await connection.query(MYSQL_SETUP_SQL)
    fixturesLoaded = true
  } catch (error) {
    console.error('Failed to load test fixtures:', error)
    throw error
  }
}

/**
 * Create a RunQueryFn backed by the test database connection.
 */
export function createMySQLRunQueryFn(): RunQueryFn {
  return async (sql: string): Promise<QueryResponse> => {
    if (!connection) {
      throw new Error('Database not connected. Call connectTestDb() first.')
    }

    try {
      const [rows, fields] = await connection.query(sql)
      return {
        success: true,
        result: Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [],
        columns: fields?.map((f) => ({ name: f.name, type: String(f.type) })) ?? null,
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
  return connection !== null
}

/**
 * Get the test configuration (for reference in tests).
 */
export { MYSQL_TEST_CONFIG }
