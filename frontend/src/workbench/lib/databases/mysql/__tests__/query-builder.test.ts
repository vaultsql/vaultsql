// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupMySQLAdapter } from '@/test/mysqlAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupMySQLAdapter()

describe('MySQLAdapter query builder', () => {
  describe('buildTableQuery', () => {
    it('builds simple SELECT query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
      })

      expect(result.sql).toContain('SELECT *')
      expect(result.sql).toContain('FROM `test_schema`.`users`')
      expect(result.countSql).toContain('SELECT COUNT(*) as total')
    })

    it('builds query with column selection', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        columns: ['id', 'email', 'username'],
      })

      expect(result.sql).toContain('SELECT `id`, `email`, `username`')
      expect(result.sql).not.toContain('SELECT *')
    })

    it('builds query with filters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [
          { column: 'is_active', operator: 'eq', value: 'true' },
          { column: 'age', operator: 'gte', value: '18' },
        ],
      })

      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain('`is_active` = ')
      expect(result.sql).toContain('`age` >= ')
      expect(result.sql).toContain('AND')
    })

    it('builds query with sorting', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        sort: [
          { column: 'created_at', direction: 'desc' },
          { column: 'username', direction: 'asc' },
        ],
      })

      expect(result.sql).toContain('ORDER BY')
      expect(result.sql).toContain('`created_at` DESC')
      expect(result.sql).toContain('`username` ASC')
    })

    it('builds query with pagination', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        limit: 10,
        offset: 20,
      })

      expect(result.sql).toContain('LIMIT 10')
      expect(result.sql).toContain('OFFSET 20')
    })

    it('handles LIKE filters with case-insensitive search', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [
          { column: 'username', operator: 'contains', value: 'alice' },
          { column: 'email', operator: 'icontains', value: 'EXAMPLE' },
        ],
      })

      expect(result.sql).toContain('`username` LIKE ')
      expect(result.sql).toContain('LOWER(`email`) LIKE LOWER(')
    })

    it('handles NULL filters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [
          { column: 'deleted_at', operator: 'isNull', value: '' },
          { column: 'display_name', operator: 'isNotNull', value: '' },
        ],
      })

      expect(result.sql).toContain('`deleted_at` IS NULL')
      expect(result.sql).toContain('`display_name` IS NOT NULL')
    })

    it('handles IN filter', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [{ column: 'username', operator: 'in', value: 'alice,bob,charlie' }],
      })

      expect(result.sql).toContain('`username` IN (')
      expect(result.sql).toContain("'alice'")
      expect(result.sql).toContain("'bob'")
      expect(result.sql).toContain("'charlie'")
    })

    it('escapes SQL injection attempts in filters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [{ column: 'username', operator: 'eq', value: "'; DROP TABLE users; --" }],
      })

      // Should escape the single quotes
      expect(result.sql).toContain("''; DROP TABLE users; --'")
    })

    it('quotes identifiers with backticks', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        columns: ['id', 'email'],
      })

      expect(result.sql).toContain('`test_schema`.`users`')
      expect(result.sql).toContain('`id`')
      expect(result.sql).toContain('`email`')
    })
  })
})
