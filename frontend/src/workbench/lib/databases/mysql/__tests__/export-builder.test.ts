// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupMySQLAdapter } from '@/test/mysqlAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupMySQLAdapter()

describe('MySQLAdapter export query builder', () => {
  describe('buildExportQuery', () => {
    it('builds a basic export query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildExportQuery({
        schema: 'test_schema',
        table: 'users',
      })

      expect(result.sql).toContain('SELECT *')
      expect(result.sql).toContain('FROM `test_schema`.`users`')
    })

    it('builds export query with selected columns', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildExportQuery({
        schema: 'test_schema',
        table: 'users',
        columns: ['id', 'email'],
      })

      expect(result.sql).toContain('SELECT `id`, `email`')
      expect(result.sql).not.toContain('SELECT *')
    })

    it('builds export query with filters and pagination', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildExportQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [{ column: 'is_active', operator: 'eq', value: 'true' }],
        limit: 50,
        offset: 100,
      })

      expect(result.sql).toContain('WHERE `is_active` =')
      expect(result.sql).toContain('LIMIT 50')
      expect(result.sql).toContain('OFFSET 100')
    })

    it('escapes identifiers with special characters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildExportQuery({
        schema: 'test_schema',
        table: 'my`table',
        columns: ['column`name'],
      })

      expect(result.sql).toContain('`my``table`')
      expect(result.sql).toContain('`column``name`')
    })
  })
})
