// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPgRunQueryFn } from '@/test/pgTestClient'
import { setupPostgresAdapter } from '@/test/postgresAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupPostgresAdapter()

describe('PostgresAdapter query integration', () => {
  describe('fetchRow', () => {
    it('fetches row by primary key', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const row = await adapter.fetchRow({
        schema: 'test_schema',
        table: 'users',
        column: 'id',
        value: 1,
      })

      expect(row).not.toBeNull()
      expect(row).toHaveProperty('email')
      expect(row).toHaveProperty('username')
    })

    it('returns null for non-existent row', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const row = await adapter.fetchRow({
        schema: 'test_schema',
        table: 'users',
        column: 'id',
        value: 999999,
      })

      expect(row).toBeNull()
    })

    it('handles string values with SQL escaping', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const row = await adapter.fetchRow({
        schema: 'test_schema',
        table: 'users',
        column: 'email',
        value: "test'injection@example.com",
      })

      expect(row).toBeNull() // Should not crash, just return null
    })
  })

  describe('buildTableQuery', () => {
    it('builds a simple SELECT * query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
      })

      expect(result.sql).toContain('SELECT *')
      expect(result.sql).toContain('FROM "test_schema"."users"')
      expect(result.countSql).toContain('SELECT COUNT(*) as total')
      expect(result.countSql).toContain('FROM "test_schema"."users"')
    })

    it('selects specific columns', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        columns: ['id', 'email', 'username'],
      })

      expect(result.sql).toContain('SELECT "id", "email", "username"')
      expect(result.sql).not.toContain('*')
    })

    it('applies filters with various operators', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [
          { column: 'email', operator: 'icontains', value: 'example.com' },
          { column: 'age', operator: 'gte', value: '25' },
          { column: 'is_active', operator: 'eq', value: 'true' },
        ],
      })

      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain('"email" ILIKE')
      expect(result.sql).toContain('%example.com%')
      expect(result.sql).toContain('"age" >=')
      expect(result.sql).toContain('"is_active" =')
    })

    it('applies sorting', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        sort: [
          { column: 'created_at', direction: 'desc' },
          { column: 'email', direction: 'asc' },
        ],
      })

      expect(result.sql).toContain('ORDER BY "created_at" DESC, "email" ASC')
    })

    it('applies pagination with limit and offset', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        limit: 25,
        offset: 50,
      })

      expect(result.sql).toContain('LIMIT 25')
      expect(result.sql).toContain('OFFSET 50')
      expect(result.countSql).not.toContain('LIMIT')
      expect(result.countSql).not.toContain('OFFSET')
    })

    it('handles isNull and isNotNull operators', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [
          { column: 'display_name', operator: 'isNotNull', value: '' },
          { column: 'deleted_at', operator: 'isNull', value: '' },
        ],
      })

      expect(result.sql).toContain('"display_name" IS NOT NULL')
      expect(result.sql).toContain('"deleted_at" IS NULL')
    })

    it('handles IN operator with multiple values', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [{ column: 'id', operator: 'in', value: '1, 2, 3' }],
      })

      expect(result.sql).toContain('"id" IN')
      expect(result.sql).toContain("'1'")
      expect(result.sql).toContain("'2'")
      expect(result.sql).toContain("'3'")
    })

    it('escapes SQL injection in values', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        filters: [{ column: 'email', operator: 'eq', value: "'; DROP TABLE users; --" }],
      })

      // Single quotes should be escaped
      expect(result.sql).toContain("'''")
      expect(result.sql).toMatch(/"email" = '.*DROP TABLE.*'/)
    })

    it('escapes identifiers with special characters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'my"table',
        columns: ['column"name'],
      })

      expect(result.sql).toContain('"my""table"')
      expect(result.sql).toContain('"column""name"')
    })

    it('executes generated query against real database', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'users',
        columns: ['id', 'email', 'username'],
        filters: [{ column: 'is_active', operator: 'eq', value: 'true' }],
        sort: [{ column: 'id', direction: 'asc' }],
        limit: 10,
      })

      const response = await runQuery(result.sql)
      expect(response.success).toBe(true)
      expect(response.result).toBeInstanceOf(Array)
      expect((response.result ?? []).length).toBeGreaterThan(0)

      const countResponse = await runQuery(result.countSql)
      expect(countResponse.success).toBe(true)
      const total = Number(countResponse.result?.[0]?.total ?? 0)
      expect(total).toBeGreaterThan(0)
    })

    it('executes complex query with all options', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()
      const result = adapter.buildTableQuery({
        schema: 'test_schema',
        table: 'products',
        columns: ['id', 'sku', 'name', 'price', 'status'],
        filters: [
          { column: 'status', operator: 'eq', value: 'active' },
          { column: 'price', operator: 'lte', value: '500' },
        ],
        sort: [{ column: 'price', direction: 'desc' }],
        limit: 5,
        offset: 0,
      })

      const response = await runQuery(result.sql)
      expect(response.success).toBe(true)
      expect((response.result ?? []).length).toBeGreaterThan(0)
    })
  })
})
