// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPgRunQueryFn } from '@/test/pgTestClient'
import { setupPostgresAdapter } from '@/test/postgresAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupPostgresAdapter()

describe('PostgresAdapter mutation integration', () => {
  describe('buildInsertQuery', () => {
    it('inserts a row and verifies via SELECT', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()
      const result = adapter.buildInsertQuery({
        schema: 'test_schema',
        table: 'categories',
        values: [
          { column: 'name', value: 'Test Category' },
          { column: 'slug', value: 'test-category' },
          { column: 'sort_order', value: 99 },
        ],
      })

      expect(result.operation).toBe('insert')
      expect(result.sql).toContain('INSERT INTO')
      expect(result.sql).toContain('"test_schema"."categories"')

      const insertResponse = await runQuery(result.sql)
      expect(insertResponse.success).toBe(true)

      // Verify via SELECT
      const selectResponse = await runQuery(
        `SELECT * FROM test_schema.categories WHERE slug = 'test-category'`,
      )
      expect(selectResponse.success).toBe(true)
      expect(selectResponse.result?.length).toBe(1)
      expect(selectResponse.result?.[0]?.name).toBe('Test Category')
    })

    it('handles NULL values', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()
      const result = adapter.buildInsertQuery({
        schema: 'test_schema',
        table: 'categories',
        values: [
          { column: 'name', value: 'Null Parent Category' },
          { column: 'slug', value: 'null-parent' },
          { column: 'parent_id', value: null, isNull: true },
        ],
      })

      expect(result.sql).toContain('NULL')

      const insertResponse = await runQuery(result.sql)
      expect(insertResponse.success).toBe(true)

      const selectResponse = await runQuery(
        `SELECT * FROM test_schema.categories WHERE slug = 'null-parent'`,
      )
      expect(selectResponse.success).toBe(true)
      expect(selectResponse.result?.[0]?.parent_id).toBeNull()
    })
  })

  describe('buildUpdateQuery', () => {
    it('updates a row by primary key and verifies via SELECT', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()
      const insertResponse = await runQuery(`
        INSERT INTO test_schema.categories (name, slug, sort_order)
        VALUES ('Update Target', 'update-target', 123)
        RETURNING id
      `)
      const targetId = insertResponse.result?.[0]?.id as number | undefined
      expect(targetId).toBeDefined()

      const result = adapter.buildUpdateQuery({
        schema: 'test_schema',
        table: 'categories',
        values: [{ column: 'name', value: 'Updated Electronics' }],
        primaryKey: { column: 'id', value: targetId ?? 0 },
      })

      expect(result.operation).toBe('update')
      expect(result.sql).toContain('UPDATE')
      expect(result.sql).toContain('SET')
      expect(result.sql).toContain('WHERE')

      const updateResponse = await runQuery(result.sql)
      expect(updateResponse.success).toBe(true)

      // Verify via SELECT
      const selectResponse = await runQuery(
        `SELECT * FROM test_schema.categories WHERE id = ${targetId ?? 0}`,
      )
      expect(selectResponse.success).toBe(true)
      expect(selectResponse.result?.[0]?.name).toBe('Updated Electronics')
      await runQuery(`DELETE FROM test_schema.categories WHERE id = ${targetId ?? 0}`)
    })
  })

  describe('buildDeleteQuery', () => {
    it('deletes a row by primary key and verifies via SELECT', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // First insert a row to delete
      const insertResult = adapter.buildInsertQuery({
        schema: 'test_schema',
        table: 'categories',
        values: [
          { column: 'name', value: 'To Be Deleted' },
          { column: 'slug', value: 'to-delete' },
        ],
      })
      await runQuery(insertResult.sql)

      // Get the inserted row's ID
      const selectBeforeResponse = await runQuery(
        `SELECT id FROM test_schema.categories WHERE slug = 'to-delete'`,
      )
      const insertedId = selectBeforeResponse.result?.[0]?.id as number

      // Now delete it
      const deleteResult = adapter.buildDeleteQuery({
        schema: 'test_schema',
        table: 'categories',
        primaryKey: { column: 'id', value: insertedId },
      })

      expect(deleteResult.operation).toBe('delete')
      expect(deleteResult.sql).toContain('DELETE FROM')
      expect(deleteResult.sql).toContain('WHERE')

      const deleteResponse = await runQuery(deleteResult.sql)
      expect(deleteResponse.success).toBe(true)

      // Verify deletion
      const selectAfterResponse = await runQuery(
        `SELECT * FROM test_schema.categories WHERE id = ${insertedId}`,
      )
      expect(selectAfterResponse.success).toBe(true)
      expect(selectAfterResponse.result?.length).toBe(0)
    })
  })
})
