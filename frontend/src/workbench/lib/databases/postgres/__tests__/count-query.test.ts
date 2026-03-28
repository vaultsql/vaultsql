// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupPostgresAdapter } from '@/test/postgresAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupPostgresAdapter()

describe('PostgresAdapter estimated count query', () => {
  describe('buildEstimatedCountQuery', () => {
    it('builds estimated count query without filters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildEstimatedCountQuery({
        schema: 'public',
        table: 'users',
      })

      expect(result.sql).toContain('SELECT reltuples::int8 as count')
      expect(result.sql).toContain('FROM pg_class c')
      expect(result.sql).toContain('JOIN pg_catalog.pg_namespace n')
      expect(result.sql).toContain("nspname = 'public'")
      expect(result.sql).toContain("relname = 'users'")

      expect(result.fallbackSql).toContain('SELECT COUNT(*) as count')
      expect(result.fallbackSql).toContain('FROM "public"."users"')
    })

    it('builds fallback count query with filters', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildEstimatedCountQuery({
        schema: 'public',
        table: 'users',
        filters: [{ column: 'is_active', operator: 'eq', value: 'true' }],
      })

      // Estimated query doesn't include filters (it's a table-level estimate)
      expect(result.sql).toContain('SELECT reltuples::int8 as count')

      // Fallback query should include filters
      expect(result.fallbackSql).toContain('SELECT COUNT(*) as count')
      expect(result.fallbackSql).toContain('WHERE')
      expect(result.fallbackSql).toContain('"is_active"')
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

      expect(result.sql).toContain("nspname = 'my_schema'")
      expect(result.sql).toContain("relname = 'my_table'")
      expect(result.fallbackSql).toContain('"my_schema"."my_table"')
    })

    it('handles special characters in names', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildEstimatedCountQuery({
        schema: "test'schema",
        table: 'test"table',
      })

      // SQL injection protection - should escape quotes
      expect(result.sql).toContain("test''schema")
      expect(result.fallbackSql).toContain('"test""table"')
    })
  })
})
