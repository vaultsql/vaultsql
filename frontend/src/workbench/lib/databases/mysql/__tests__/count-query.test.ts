// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupMySQLAdapter } from '@/test/mysqlAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupMySQLAdapter()

describe('MySQLAdapter estimated count query', () => {
  describe('buildEstimatedCountQuery', () => {
    it('builds estimated count query without filters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildEstimatedCountQuery({
        schema: 'test_db',
        table: 'users',
      })

      expect(result.sql).toContain('SELECT table_rows as count')
      expect(result.sql).toContain('FROM information_schema.TABLES')
      expect(result.sql).toContain("TABLE_SCHEMA = 'test_db'")
      expect(result.sql).toContain("TABLE_NAME = 'users'")

      expect(result.fallbackSql).toContain('SELECT COUNT(*) as count')
      expect(result.fallbackSql).toContain('FROM `test_db`.`users`')
    })

    it('builds fallback count query with filters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildEstimatedCountQuery({
        schema: 'test_db',
        table: 'users',
        filters: [{ column: 'is_active', operator: 'eq', value: 'true' }],
      })

      // Estimated query doesn't include filters (it's a table-level estimate)
      expect(result.sql).toContain('SELECT table_rows as count')

      // Fallback query should include filters
      expect(result.fallbackSql).toContain('SELECT COUNT(*) as count')
      expect(result.fallbackSql).toContain('WHERE')
      expect(result.fallbackSql).toContain('`is_active`')
    })

    it('properly escapes schema and table names', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildEstimatedCountQuery({
        schema: 'my_schema',
        table: 'my_table',
      })

      expect(result.sql).toContain("TABLE_SCHEMA = 'my_schema'")
      expect(result.sql).toContain("TABLE_NAME = 'my_table'")
      expect(result.fallbackSql).toContain('`my_schema`.`my_table`')
    })

    it('handles special characters in names', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildEstimatedCountQuery({
        schema: "test'schema",
        table: 'test`table',
      })

      // SQL injection protection - should escape quotes
      expect(result.sql).toContain("test''schema")
      expect(result.fallbackSql).toContain('`test``table`')
    })
  })
})
