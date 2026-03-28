// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupMySQLAdapter } from '@/test/mysqlAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupMySQLAdapter()

describe('MySQLAdapter mutations', () => {
  describe('buildInsertQuery', () => {
    it('builds basic INSERT query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildInsertQuery({
        schema: 'test_schema',
        table: 'users',
        values: [
          { column: 'email', value: 'newuser@example.com', isNull: false, useDefault: false },
          { column: 'username', value: 'newuser', isNull: false, useDefault: false },
          { column: 'age', value: 25, isNull: false, useDefault: false },
        ],
      })

      expect(result.sql).toContain('INSERT INTO `test_schema`.`users`')
      expect(result.sql).toContain('`email`, `username`, `age`')
      expect(result.sql).toContain('VALUES')
      expect(result.sql).toContain("'newuser@example.com'")
      expect(result.sql).toContain("'newuser'")
      expect(result.sql).toContain('25')
      expect(result.operation).toBe('insert')
    })

    it('handles NULL values', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildInsertQuery({
        schema: 'test_schema',
        table: 'users',
        values: [
          { column: 'email', value: 'user@example.com', isNull: false, useDefault: false },
          { column: 'username', value: 'user', isNull: false, useDefault: false },
          { column: 'display_name', value: null, isNull: true, useDefault: false },
        ],
      })

      expect(result.sql).toContain('NULL')
    })

    it('skips columns with useDefault=true', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildInsertQuery({
        schema: 'test_schema',
        table: 'users',
        values: [
          { column: 'email', value: 'user@example.com', isNull: false, useDefault: false },
          { column: 'username', value: 'user', isNull: false, useDefault: false },
          { column: 'created_at', value: null, isNull: false, useDefault: true },
        ],
      })

      expect(result.sql).not.toContain('created_at')
      expect(result.sql).toContain('`email`, `username`')
    })

    it('handles boolean values', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildInsertQuery({
        schema: 'test_schema',
        table: 'users',
        values: [
          { column: 'email', value: 'user@example.com', isNull: false, useDefault: false },
          { column: 'username', value: 'user', isNull: false, useDefault: false },
          { column: 'is_active', value: true, isNull: false, useDefault: false },
        ],
      })

      expect(result.sql).toContain('TRUE')
    })
  })

  describe('buildUpdateQuery', () => {
    it('builds basic UPDATE query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildUpdateQuery({
        schema: 'test_schema',
        table: 'users',
        values: [
          { column: 'username', value: 'updated_user', isNull: false, useDefault: false },
          { column: 'age', value: 30, isNull: false, useDefault: false },
        ],
        primaryKey: { column: 'id', value: 1 },
      })

      expect(result.sql).toContain('UPDATE `test_schema`.`users`')
      expect(result.sql).toContain('SET')
      expect(result.sql).toContain('`username` = ')
      expect(result.sql).toContain('`age` = ')
      expect(result.sql).toContain('WHERE `id` = 1')
      expect(result.operation).toBe('update')
    })

    it('handles NULL values in UPDATE', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildUpdateQuery({
        schema: 'test_schema',
        table: 'users',
        values: [{ column: 'display_name', value: null, isNull: true, useDefault: false }],
        primaryKey: { column: 'id', value: 1 },
      })

      expect(result.sql).toContain('`display_name` = NULL')
    })

    it('skips columns with useDefault=true in UPDATE', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildUpdateQuery({
        schema: 'test_schema',
        table: 'users',
        values: [
          { column: 'username', value: 'updated', isNull: false, useDefault: false },
          { column: 'updated_at', value: null, isNull: false, useDefault: true },
        ],
        primaryKey: { column: 'id', value: 1 },
      })

      expect(result.sql).toContain('`username` = ')
      expect(result.sql).not.toContain('updated_at')
    })
  })

  describe('buildDeleteQuery', () => {
    it('builds basic DELETE query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildDeleteQuery({
        schema: 'test_schema',
        table: 'users',
        primaryKey: { column: 'id', value: 1 },
      })

      expect(result.sql).toContain('DELETE FROM `test_schema`.`users`')
      expect(result.sql).toContain('WHERE `id` = 1')
      expect(result.operation).toBe('delete')
    })

    it('handles string primary key values', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildDeleteQuery({
        schema: 'test_schema',
        table: 'products',
        primaryKey: { column: 'sku', value: 'DELL-XPS-13' },
      })

      expect(result.sql).toContain("WHERE `sku` = 'DELL-XPS-13'")
    })
  })
})
