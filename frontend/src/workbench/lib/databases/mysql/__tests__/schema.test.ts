// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupMySQLAdapter } from '@/test/mysqlAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupMySQLAdapter()

describe('MySQLAdapter schema integration', () => {
  describe('loadSchemaNames', () => {
    it('returns schema names including test_schema', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const schemas = await adapter.loadSchemaNames()

      expect(schemas).toBeInstanceOf(Array)
      expect(schemas.length).toBeGreaterThan(0)
      expect(schemas).toContain('test_schema')
      expect(schemas).not.toContain('information_schema')
      expect(schemas).not.toContain('mysql')
      expect(schemas).not.toContain('performance_schema')
    })
  })

  describe('loadSchemaAssets', () => {
    it('returns tables from test_schema', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const assets = await adapter.loadSchemaAssets('test_schema')

      expect(assets).toBeInstanceOf(Array)

      const tableNames = assets.map((a) => a.name)
      expect(tableNames).toContain('users')
      expect(tableNames).toContain('categories')
      expect(tableNames).toContain('products')
      expect(tableNames).toContain('orders')
      expect(tableNames).toContain('order_items')

      // Verify asset structure
      const usersAsset = assets.find((a) => a.name === 'users')
      expect(usersAsset?.type).toBe('table')
      expect(usersAsset?.schema).toBe('test_schema')
    })
  })

  describe('describeTable', () => {
    it('returns columns for users table', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const structure = await adapter.describeTable('test_schema', 'users')

      expect(structure).toHaveProperty('columns')
      expect(structure).toHaveProperty('indexes')
      expect(structure).toHaveProperty('foreignKeys')

      const { columns } = structure

      // Check primary key
      const idCol = columns.find((c) => c.name === 'id')
      expect(idCol?.isPrimaryKey).toBe(true)
      expect(idCol?.nullable).toBe(false)
      expect(idCol?.isAutoIncrement).toBe(true)

      // Check various column types
      const emailCol = columns.find((c) => c.name === 'email')
      expect(emailCol?.category).toBe('text')
      expect(emailCol?.nullable).toBe(false)

      const metadataCol = columns.find((c) => c.name === 'metadata')
      expect(metadataCol?.category).toBe('json')

      const isActiveCol = columns.find((c) => c.name === 'is_active')
      expect(isActiveCol?.category).toBe('boolean')
    })

    it('returns indexes for users table', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const structure = await adapter.describeTable('test_schema', 'users')
      const { indexes } = structure

      expect(indexes.length).toBeGreaterThan(0)

      // Primary key index
      const pkIndex = indexes.find((i) => i.isPrimary)
      expect(pkIndex).toBeDefined()
      expect(pkIndex?.columns).toContain('id')

      // Unique email index
      const emailIndex = indexes.find((i) => i.columns.includes('email'))
      expect(emailIndex).toBeDefined()
      expect(emailIndex?.isUnique).toBe(true)
    })

    it('returns foreign keys for orders table', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const structure = await adapter.describeTable('test_schema', 'orders')
      const { foreignKeys } = structure

      expect(foreignKeys.length).toBeGreaterThan(0)

      const userFk = foreignKeys.find((fk) => fk.column === 'user_id')
      expect(userFk).toBeDefined()
      expect(userFk?.refTable).toBe('users')
      expect(userFk?.refColumn).toBe('id')
      expect(userFk?.onDelete).toBe('CASCADE')
    })
  })

  describe('loadAllColumns', () => {
    it('loads all columns for test_schema', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      if (!adapter.loadAllColumns) {
        throw new Error('loadAllColumns is not implemented')
      }
      const columnsMap = await adapter.loadAllColumns('test_schema')

      expect(columnsMap).toBeInstanceOf(Map)
      expect(columnsMap.size).toBeGreaterThan(0)

      const usersColumns = columnsMap.get('test_schema.users')
      expect(usersColumns).toBeDefined()
      expect(usersColumns?.length).toBeGreaterThan(0)

      const idColumn = usersColumns?.find((c) => c.name === 'id')
      expect(idColumn).toBeDefined()
      expect(idColumn?.isPrimaryKey).toBe(true)
    })
  })

  describe('fetchRow', () => {
    it('fetches a single row by column value', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const row = await adapter.fetchRow({
        schema: 'test_schema',
        table: 'users',
        column: 'email',
        value: 'alice@example.com',
      })

      expect(row).toBeDefined()
      expect(row).not.toBeNull()
      expect(row?.email).toBe('alice@example.com')
      expect(row?.username).toBe('alice')
    })

    it('returns null when no row matches', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const row = await adapter.fetchRow({
        schema: 'test_schema',
        table: 'users',
        column: 'email',
        value: 'nonexistent@example.com',
      })

      expect(row).toBeNull()
    })
  })

  describe('loadSchemaObjects', () => {
    it('returns functions and procedures', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const objects = await adapter.loadSchemaObjects!('test_schema')

      expect(objects).toBeInstanceOf(Array)
      expect(objects.length).toBeGreaterThan(0)

      // Check for function
      const func = objects.find((o) => o.name === 'get_user_total_orders')
      expect(func).toBeDefined()
      expect(func?.type).toBe('function')
      expect(func?.schema).toBe('test_schema')

      // Check for procedure
      const proc = objects.find((o) => o.name === 'update_product_quantity')
      expect(proc).toBeDefined()
      expect(proc?.type).toBe('procedure')

      // Regular views should NOT be in this list
      const view = objects.find((o) => o.name === 'active_products_view')
      expect(view).toBeUndefined()
    })

    it('returns empty array for schema with no objects', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const objects = await adapter.loadSchemaObjects!('information_schema')

      expect(objects).toBeInstanceOf(Array)
    })
  })

  describe('getObjectDefinition', () => {
    it('returns CREATE statement for a function', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const definition = await adapter.getObjectDefinition!(
        'test_schema',
        'get_user_total_orders',
        'function',
      )

      expect(definition).toBeDefined()
      expect(definition).toContain('CREATE')
      expect(definition).toContain('FUNCTION')
      expect(definition).toContain('get_user_total_orders')
      expect(definition).toContain('RETURNS')
    })

    it('returns CREATE statement for a procedure', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const definition = await adapter.getObjectDefinition!(
        'test_schema',
        'update_product_quantity',
        'procedure',
      )

      expect(definition).toBeDefined()
      expect(definition).toContain('CREATE')
      expect(definition).toContain('PROCEDURE')
      expect(definition).toContain('update_product_quantity')
      expect(definition).toContain('product_id_param')
    })

    it('throws error for materialized views (not supported in MySQL)', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      await expect(
        adapter.getObjectDefinition!('test_schema', 'some_view', 'materialized_view'),
      ).rejects.toThrow('MySQL does not support materialized views')
    })

    it('throws error for non-existent object', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      await expect(
        adapter.getObjectDefinition!('test_schema', 'nonexistent_function', 'function'),
      ).rejects.toThrow()
    })
  })

  describe('getViewDefinition', () => {
    it('returns CREATE statement for a view', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const definition = await adapter.getViewDefinition!('test_schema', 'active_products_view')

      expect(definition).toBeDefined()
      expect(definition).toContain('CREATE OR REPLACE VIEW')
      expect(definition).toContain('active_products_view')
      // MySQL returns lowercase 'select' in the VIEW_DEFINITION
      expect(definition.toLowerCase()).toContain('select')
    })

    it('throws error for non-existent view', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      await expect(adapter.getViewDefinition!('test_schema', 'nonexistent_view')).rejects.toThrow()
    })
  })
})
