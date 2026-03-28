// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupPostgresAdapter } from '@/test/postgresAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupPostgresAdapter()

describe('PostgresAdapter schema integration', () => {
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
      expect(schemas).not.toContain('pg_catalog')
      expect(schemas).not.toContain('information_schema')
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

      const tagsCol = columns.find((c) => c.name === 'tags')
      expect(tagsCol?.category).toBe('array')
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
      expect(emailIndex?.isUnique).toBe(true)
    })

    it('returns foreign keys for orders table', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const structure = await adapter.describeTable('test_schema', 'orders')
      const { foreignKeys } = structure

      const userFk = foreignKeys.find((fk) => fk.column === 'user_id')
      expect(userFk).toBeDefined()
      expect(userFk?.refTable).toBe('users')
      expect(userFk?.refColumn).toBe('id')
      expect(userFk?.refSchema).toBe('test_schema')
      expect(userFk?.onDelete).toBe('CASCADE')
    })

    it('returns multiple foreign keys for order_items table', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const structure = await adapter.describeTable('test_schema', 'order_items')
      const { foreignKeys } = structure

      const orderFk = foreignKeys.find((fk) => fk.column === 'order_id')
      expect(orderFk?.refTable).toBe('orders')
      expect(orderFk?.onDelete).toBe('CASCADE')

      const productFk = foreignKeys.find((fk) => fk.column === 'product_id')
      expect(productFk?.refTable).toBe('products')
      expect(productFk?.onDelete).toBe('RESTRICT')
    })

    it('returns self-referential foreign key for categories', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const structure = await adapter.describeTable('test_schema', 'categories')
      const { foreignKeys } = structure

      const parentFk = foreignKeys.find((fk) => fk.column === 'parent_id')
      expect(parentFk).toBeDefined()
      expect(parentFk?.refTable).toBe('categories')
      expect(parentFk?.onDelete).toBe('SET NULL')
    })
  })

  describe('loadAllColumns', () => {
    it('bulk loads columns for entire schema', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const columnsMap = await adapter.loadAllColumns!('test_schema')

      expect(columnsMap).toBeInstanceOf(Map)

      const usersKey = 'test_schema.users'
      expect(columnsMap.has(usersKey)).toBe(true)

      const userCols = columnsMap.get(usersKey)!

      const colNames = userCols.map((c) => c.name)
      expect(colNames).toContain('id')
      expect(colNames).toContain('email')
      expect(colNames).toContain('metadata')
    })
  })

  describe('loadSchemaObjects', () => {
    it('returns functions, procedures, and materialized views', async () => {
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

      // Check for materialized view
      const matView = objects.find((o) => o.name === 'product_sales_summary')
      expect(matView).toBeDefined()
      expect(matView?.type).toBe('materialized_view')

      // Regular views should NOT be in this list
      const view = objects.find((o) => o.name === 'active_products_view')
      expect(view).toBeUndefined()
    })

    it('returns empty array for schema with no objects', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const objects = await adapter.loadSchemaObjects!('public')

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
      expect(definition).toContain('CREATE OR REPLACE FUNCTION')
      expect(definition).toContain('get_user_total_orders')
      expect(definition).toContain('RETURNS numeric')
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
      expect(definition).toContain('CREATE OR REPLACE PROCEDURE')
      expect(definition).toContain('update_product_quantity')
      expect(definition).toContain('product_id_param')
    })

    it('returns CREATE statement for a materialized view', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const definition = await adapter.getObjectDefinition!(
        'test_schema',
        'product_sales_summary',
        'materialized_view',
      )

      expect(definition).toBeDefined()
      expect(definition).toContain('CREATE MATERIALIZED VIEW')
      expect(definition).toContain('product_sales_summary')
      expect(definition).toContain('SELECT')
    })

    it('throws error for non-existent object', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      await expect(
        adapter.getObjectDefinition!('test_schema', 'nonexistent_function', 'function'),
      ).rejects.toThrow('Object not found')
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
      expect(definition).toContain('SELECT')
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
