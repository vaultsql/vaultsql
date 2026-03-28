// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPgRunQueryFn } from '@/test/pgTestClient'
import { setupPostgresAdapter } from '@/test/postgresAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupPostgresAdapter()

describe('PostgresAdapter DDL integration', () => {
  describe('buildCreateTableQuery', () => {
    it('creates a simple table with various column types', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Clean up if table exists from previous test run
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_simple CASCADE')

      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'ddl_test_simple',
        columns: [
          { name: 'id', dataType: 'SERIAL', primaryKey: true },
          { name: 'name', dataType: 'VARCHAR(100)', nullable: false },
          { name: 'description', dataType: 'TEXT' },
          { name: 'price', dataType: 'NUMERIC(10,2)', defaultValue: '0.00' },
          { name: 'is_active', dataType: 'BOOLEAN', defaultValue: 'true' },
          { name: 'created_at', dataType: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP' },
        ],
      })

      expect(result.operation).toBe('create_table')
      expect(result.sql).toContain('CREATE TABLE')
      expect(result.sql).toContain('"test_schema"."ddl_test_simple"')

      const createResponse = await runQuery(result.sql)
      expect(createResponse.success).toBe(true)

      // Verify via describeTable
      const structure = await adapter.describeTable('test_schema', 'ddl_test_simple')

      const idCol = structure.columns.find((c) => c.name === 'id')
      expect(idCol?.isPrimaryKey).toBe(true)
      expect(idCol?.isAutoIncrement).toBe(true)

      const nameCol = structure.columns.find((c) => c.name === 'name')
      expect(nameCol?.nullable).toBe(false)

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_simple CASCADE')
    })

    it('creates a table with primary key, unique, and foreign key constraints', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Clean up if table exists from previous test run
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_constrained CASCADE')

      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'ddl_test_constrained',
        columns: [
          { name: 'id', dataType: 'SERIAL', primaryKey: true },
          { name: 'email', dataType: 'VARCHAR(255)', nullable: false, unique: true },
          {
            name: 'user_id',
            dataType: 'INTEGER',
            references: {
              schema: 'test_schema',
              table: 'users',
              column: 'id',
              onDelete: 'CASCADE',
            },
          },
          { name: 'status', dataType: 'VARCHAR(20)', check: "status IN ('active', 'inactive')" },
        ],
      })

      expect(result.operation).toBe('create_table')
      expect(result.sql).toContain('UNIQUE')
      expect(result.sql).toContain('REFERENCES')
      expect(result.sql).toContain('ON DELETE CASCADE')
      expect(result.sql).toContain('CHECK')

      const createResponse = await runQuery(result.sql)
      expect(createResponse.success).toBe(true)

      // Verify via describeTable
      const structure = await adapter.describeTable('test_schema', 'ddl_test_constrained')

      // Check foreign key
      const fk = structure.foreignKeys.find((f) => f.column === 'user_id')
      expect(fk).toBeDefined()
      expect(fk?.refTable).toBe('users')
      expect(fk?.onDelete).toBe('CASCADE')

      // Check unique index on email
      const emailIndex = structure.indexes.find((i) => i.columns.includes('email'))
      expect(emailIndex?.isUnique).toBe(true)

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_constrained CASCADE')
    })
  })

  describe('buildDropTableQuery', () => {
    it('drops a table with IF EXISTS', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a table to drop
      await runQuery(`
        CREATE TABLE IF NOT EXISTS test_schema.ddl_test_drop (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `)

      // Verify it exists
      const assetsBefore = await adapter.loadSchemaAssets('test_schema')
      expect(assetsBefore.map((a) => a.name)).toContain('ddl_test_drop')

      const result = adapter.buildDropTableQuery({
        schema: 'test_schema',
        table: 'ddl_test_drop',
        ifExists: true,
      })

      expect(result.operation).toBe('drop_table')
      expect(result.sql).toContain('DROP TABLE IF EXISTS')
      expect(result.sql).toContain('"test_schema"."ddl_test_drop"')

      const dropResponse = await runQuery(result.sql)
      expect(dropResponse.success).toBe(true)

      // Verify it's gone via loadSchemaAssets
      const assetsAfter = await adapter.loadSchemaAssets('test_schema')
      expect(assetsAfter.map((a) => a.name)).not.toContain('ddl_test_drop')
    })
  })

  describe('buildTruncateTableQuery', () => {
    it('truncates a table and verifies data is removed', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create and populate a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_truncate CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_truncate (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `)
      await runQuery(
        `INSERT INTO test_schema.ddl_test_truncate (name) VALUES ('test1'), ('test2'), ('test3')`,
      )

      // Verify data exists
      const beforeResponse = await runQuery(
        'SELECT COUNT(*) as cnt FROM test_schema.ddl_test_truncate',
      )
      expect(beforeResponse.result?.[0]?.cnt).toBe('3')

      const result = adapter.buildTruncateTableQuery({
        schema: 'test_schema',
        table: 'ddl_test_truncate',
        restartIdentity: true,
      })

      expect(result.operation).toBe('truncate_table')
      expect(result.sql).toContain('TRUNCATE TABLE')
      expect(result.sql).toContain('RESTART IDENTITY')

      const truncateResponse = await runQuery(result.sql)
      expect(truncateResponse.success).toBe(true)

      // Verify data is gone
      const afterResponse = await runQuery(
        'SELECT COUNT(*) as cnt FROM test_schema.ddl_test_truncate',
      )
      expect(afterResponse.result?.[0]?.cnt).toBe('0')

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_truncate CASCADE')
    })
  })

  describe('buildRenameTableQuery', () => {
    it('renames a table and verifies via schema assets', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a table to rename
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_rename_old CASCADE')
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_rename_new CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_rename_old (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `)

      // Verify old name exists
      const assetsBefore = await adapter.loadSchemaAssets('test_schema')
      expect(assetsBefore.map((a) => a.name)).toContain('ddl_test_rename_old')

      const result = adapter.buildRenameTableQuery({
        schema: 'test_schema',
        table: 'ddl_test_rename_old',
        newName: 'ddl_test_rename_new',
      })

      expect(result.operation).toBe('alter_table')
      expect(result.sql).toContain('ALTER TABLE')
      expect(result.sql).toContain('RENAME TO')
      expect(result.sql).toContain('"ddl_test_rename_new"')

      const renameResponse = await runQuery(result.sql)
      expect(renameResponse.success).toBe(true)

      // Verify via loadSchemaAssets
      const assetsAfter = await adapter.loadSchemaAssets('test_schema')
      expect(assetsAfter.map((a) => a.name)).not.toContain('ddl_test_rename_old')
      expect(assetsAfter.map((a) => a.name)).toContain('ddl_test_rename_new')

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_rename_new CASCADE')
    })
  })

  describe('buildAddColumnQuery', () => {
    it('adds a column and verifies via describeTable', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_add_col CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_add_col (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `)

      const result = adapter.buildAddColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_add_col',
        column: {
          name: 'email',
          dataType: 'VARCHAR(255)',
          nullable: false,
          defaultValue: "'unknown@example.com'",
        },
      })

      expect(result.operation).toBe('alter_table')
      expect(result.sql).toContain('ALTER TABLE')
      expect(result.sql).toContain('ADD COLUMN')
      expect(result.sql).toContain('"email"')
      expect(result.sql).toContain('NOT NULL')
      expect(result.sql).toContain('DEFAULT')

      const addResponse = await runQuery(result.sql)
      expect(addResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_add_col')

      const emailCol = structureAfter.columns.find((c) => c.name === 'email')
      expect(emailCol).toBeDefined()
      expect(emailCol?.nullable).toBe(false)
      expect(emailCol?.category).toBe('text')

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_add_col CASCADE')
    })

    it('adds a nullable column without default', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_add_col_nullable CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_add_col_nullable (
          id SERIAL PRIMARY KEY
        )
      `)

      const result = adapter.buildAddColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_add_col_nullable',
        column: {
          name: 'notes',
          dataType: 'text',
          nullable: true,
        },
      })

      expect(result.operation).toBe('alter_table')
      expect(result.sql).toContain('ADD COLUMN')
      expect(result.sql).toContain('"notes"')
      expect(result.sql).not.toContain('NOT NULL')
      expect(result.sql).not.toContain('DEFAULT')

      const addResponse = await runQuery(result.sql)
      expect(addResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_add_col_nullable')
      const notesCol = structureAfter.columns.find((c) => c.name === 'notes')
      expect(notesCol).toBeDefined()
      expect(notesCol?.nullable).toBe(true)
      expect(notesCol?.defaultValue).toBeNull()

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_add_col_nullable CASCADE')
    })

    it('adds a column with various data types', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_add_col_types CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_add_col_types (
          id SERIAL PRIMARY KEY
        )
      `)

      // Test adding various column types
      const columnsToAdd = [
        { name: 'is_active', dataType: 'boolean', defaultValue: 'false' },
        { name: 'created_at', dataType: 'timestamptz', defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'metadata', dataType: 'jsonb' },
        { name: 'count', dataType: 'integer', nullable: false, defaultValue: '0' },
      ]

      for (const col of columnsToAdd) {
        const result = adapter.buildAddColumnQuery({
          schema: 'test_schema',
          table: 'ddl_test_add_col_types',
          column: col,
        })

        const addResponse = await runQuery(result.sql)
        expect(addResponse.success).toBe(true)
      }

      // Verify all columns were added
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_add_col_types')
      expect(structureAfter.columns.map((c) => c.name)).toContain('is_active')
      expect(structureAfter.columns.map((c) => c.name)).toContain('created_at')
      expect(structureAfter.columns.map((c) => c.name)).toContain('metadata')
      expect(structureAfter.columns.map((c) => c.name)).toContain('count')

      const boolCol = structureAfter.columns.find((c) => c.name === 'is_active')
      expect(boolCol?.category).toBe('boolean')

      const jsonCol = structureAfter.columns.find((c) => c.name === 'metadata')
      expect(jsonCol?.category).toBe('json')

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_add_col_types CASCADE')
    })
  })

  describe('buildDropColumnQuery', () => {
    it('drops a column and verifies via describeTable', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_drop_col CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_drop_col (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          to_remove VARCHAR(50)
        )
      `)

      // Verify initial columns
      const structureBefore = await adapter.describeTable('test_schema', 'ddl_test_drop_col')
      expect(structureBefore.columns.map((c) => c.name)).toContain('to_remove')

      const result = adapter.buildDropColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_drop_col',
        column: 'to_remove',
      })

      expect(result.operation).toBe('alter_table')
      expect(result.sql).toContain('ALTER TABLE')
      expect(result.sql).toContain('DROP COLUMN')
      expect(result.sql).toContain('"to_remove"')

      const dropResponse = await runQuery(result.sql)
      expect(dropResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_drop_col')
      expect(structureAfter.columns.map((c) => c.name)).not.toContain('to_remove')

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_drop_col CASCADE')
    })
  })

  describe('buildRenameColumnQuery', () => {
    it('renames a column and verifies via describeTable', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_rename_col CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_rename_col (
          id SERIAL PRIMARY KEY,
          old_name VARCHAR(100)
        )
      `)

      // Verify initial columns
      const structureBefore = await adapter.describeTable('test_schema', 'ddl_test_rename_col')
      expect(structureBefore.columns.map((c) => c.name)).toContain('old_name')

      const result = adapter.buildRenameColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_rename_col',
        column: 'old_name',
        newName: 'new_name',
      })

      expect(result.operation).toBe('alter_table')
      expect(result.sql).toContain('ALTER TABLE')
      expect(result.sql).toContain('RENAME COLUMN')
      expect(result.sql).toContain('"old_name"')
      expect(result.sql).toContain('"new_name"')

      const renameResponse = await runQuery(result.sql)
      expect(renameResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_rename_col')
      expect(structureAfter.columns.map((c) => c.name)).not.toContain('old_name')
      expect(structureAfter.columns.map((c) => c.name)).toContain('new_name')

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_rename_col CASCADE')
    })
  })

  describe('buildAlterColumnQuery', () => {
    it('alters column type, nullable, and default', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_col CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_alter_col (
          id SERIAL PRIMARY KEY,
          amount INTEGER
        )
      `)

      // Change type to NUMERIC
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_alter_col',
        column: 'amount',
        dataType: 'NUMERIC(10,2)',
        nullable: false,
        defaultValue: '0.00',
      })

      expect(result.operation).toBe('alter_table')
      expect(result.sql).toContain('ALTER TABLE')
      expect(result.sql).toContain('SET DATA TYPE')
      expect(result.sql).toContain('SET NOT NULL')
      expect(result.sql).toContain('SET DEFAULT')

      const alterResponse = await runQuery(result.sql)
      expect(alterResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_alter_col')
      const amountAfter = structureAfter.columns.find((c) => c.name === 'amount')
      expect(amountAfter?.nullable).toBe(false)

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_col CASCADE')
    })

    it('drops NOT NULL constraint from column', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table with a NOT NULL column
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_drop_notnull CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_alter_drop_notnull (
          id SERIAL PRIMARY KEY,
          required_field VARCHAR(100) NOT NULL
        )
      `)

      // Verify column is NOT NULL initially
      const structureBefore = await adapter.describeTable(
        'test_schema',
        'ddl_test_alter_drop_notnull',
      )
      const colBefore = structureBefore.columns.find((c) => c.name === 'required_field')
      expect(colBefore?.nullable).toBe(false)

      // Drop NOT NULL
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_alter_drop_notnull',
        column: 'required_field',
        nullable: true,
      })

      expect(result.sql).toContain('DROP NOT NULL')

      const alterResponse = await runQuery(result.sql)
      expect(alterResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable(
        'test_schema',
        'ddl_test_alter_drop_notnull',
      )
      const colAfter = structureAfter.columns.find((c) => c.name === 'required_field')
      expect(colAfter?.nullable).toBe(true)

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_drop_notnull CASCADE')
    })

    it('drops default from column', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table with a default
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_drop_default CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_alter_drop_default (
          id SERIAL PRIMARY KEY,
          status VARCHAR(20) DEFAULT 'pending'
        )
      `)

      // Verify column has default initially
      const structureBefore = await adapter.describeTable(
        'test_schema',
        'ddl_test_alter_drop_default',
      )
      const colBefore = structureBefore.columns.find((c) => c.name === 'status')
      expect(colBefore?.defaultValue).not.toBeNull()

      // Drop default (pass null)
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_alter_drop_default',
        column: 'status',
        defaultValue: null,
      })

      expect(result.sql).toContain('DROP DEFAULT')

      const alterResponse = await runQuery(result.sql)
      expect(alterResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable(
        'test_schema',
        'ddl_test_alter_drop_default',
      )
      const colAfter = structureAfter.columns.find((c) => c.name === 'status')
      expect(colAfter?.defaultValue).toBeNull()

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_drop_default CASCADE')
    })

    it('changes only the default value', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_default_only CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_alter_default_only (
          id SERIAL PRIMARY KEY,
          count INTEGER DEFAULT 0
        )
      `)

      // Change only the default
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'ddl_test_alter_default_only',
        column: 'count',
        defaultValue: '100',
      })

      expect(result.sql).toContain('SET DEFAULT')
      expect(result.sql).not.toContain('SET DATA TYPE')
      expect(result.sql).not.toContain('NOT NULL')

      const alterResponse = await runQuery(result.sql)
      expect(alterResponse.success).toBe(true)

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_alter_default_only CASCADE')
    })
  })

  describe('buildCreateIndexQuery', () => {
    it('creates an index and verifies via describeTable', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_create_idx CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_create_idx (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255),
          status VARCHAR(20)
        )
      `)

      const result = adapter.buildCreateIndexQuery({
        schema: 'test_schema',
        table: 'ddl_test_create_idx',
        index: {
          name: 'idx_email_status',
          columns: ['email', 'status'],
          unique: false,
        },
      })

      expect(result.operation).toBe('create_index')
      expect(result.sql).toContain('CREATE INDEX')
      expect(result.sql).toContain('"idx_email_status"')
      expect(result.sql).toContain('"email"')
      expect(result.sql).toContain('"status"')

      const createResponse = await runQuery(result.sql)
      expect(createResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_create_idx')
      const newIndex = structureAfter.indexes.find((i) => i.name === 'idx_email_status')
      expect(newIndex).toBeDefined()
      expect(newIndex?.columns).toContain('email')
      expect(newIndex?.columns).toContain('status')
      expect(newIndex?.isUnique).toBe(false)

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_create_idx CASCADE')
    })
  })

  describe('buildDropIndexQuery', () => {
    it('drops an index and verifies via describeTable', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      // Create a test table with an index
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_drop_idx CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_drop_idx (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255)
        )
      `)
      await runQuery('CREATE INDEX idx_to_drop ON test_schema.ddl_test_drop_idx (email)')

      // Verify index exists
      const structureBefore = await adapter.describeTable('test_schema', 'ddl_test_drop_idx')
      const indexBefore = structureBefore.indexes.find((i) => i.name === 'idx_to_drop')
      expect(indexBefore).toBeDefined()

      const result = adapter.buildDropIndexQuery({
        schema: 'test_schema',
        indexName: 'idx_to_drop',
        ifExists: true,
      })

      expect(result.operation).toBe('drop_index')
      expect(result.sql).toContain('DROP INDEX IF EXISTS')
      expect(result.sql).toContain('"test_schema"."idx_to_drop"')

      const dropResponse = await runQuery(result.sql)
      expect(dropResponse.success).toBe(true)

      // Verify via describeTable
      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_drop_idx')
      const indexAfter = structureAfter.indexes.find((i) => i.name === 'idx_to_drop')
      expect(indexAfter).toBeUndefined()

      // Cleanup
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_drop_idx CASCADE')
    })
  })

  describe('buildAddForeignKeyQuery', () => {
    it('adds a foreign key and verifies via describeTable', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_child CASCADE')
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_parent CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_fk_parent (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `)
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_fk_child (
          id SERIAL PRIMARY KEY,
          user_id INTEGER
        )
      `)

      const result = adapter.buildAddForeignKeyQuery({
        schema: 'test_schema',
        table: 'ddl_test_fk_child',
        column: 'user_id',
        constraintName: 'fk_child_user',
        refSchema: 'test_schema',
        refTable: 'ddl_test_fk_parent',
        refColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      })

      expect(result.operation).toBe('alter_table')
      expect(result.sql).toContain('ALTER TABLE')
      expect(result.sql).toContain('ADD CONSTRAINT')
      expect(result.sql).toContain('FOREIGN KEY')
      expect(result.sql).toContain('REFERENCES')
      expect(result.sql).toContain('ON DELETE CASCADE')
      expect(result.sql).toContain('ON UPDATE NO ACTION')

      const addResponse = await runQuery(result.sql)
      expect(addResponse.success).toBe(true)

      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_fk_child')
      const fk = structureAfter.foreignKeys.find((f) => f.constraintName === 'fk_child_user')
      expect(fk).toBeDefined()
      expect(fk?.column).toBe('user_id')
      expect(fk?.refTable).toBe('ddl_test_fk_parent')
      expect(fk?.refColumn).toBe('id')
      expect(fk?.onDelete).toBe('CASCADE')

      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_child CASCADE')
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_parent CASCADE')
    })
  })

  describe('buildDropForeignKeyQuery', () => {
    it('drops a foreign key and verifies via describeTable', async () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const runQuery = createPgRunQueryFn()

      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_drop_child CASCADE')
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_drop_parent CASCADE')
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_fk_drop_parent (
          id SERIAL PRIMARY KEY
        )
      `)
      await runQuery(`
        CREATE TABLE test_schema.ddl_test_fk_drop_child (
          id SERIAL PRIMARY KEY,
          parent_id INTEGER
        )
      `)

      const addResult = adapter.buildAddForeignKeyQuery({
        schema: 'test_schema',
        table: 'ddl_test_fk_drop_child',
        column: 'parent_id',
        constraintName: 'fk_drop_parent',
        refSchema: 'test_schema',
        refTable: 'ddl_test_fk_drop_parent',
        refColumn: 'id',
      })
      await runQuery(addResult.sql)

      const dropResult = adapter.buildDropForeignKeyQuery({
        schema: 'test_schema',
        table: 'ddl_test_fk_drop_child',
        constraintName: 'fk_drop_parent',
        cascade: true,
      })

      expect(dropResult.operation).toBe('alter_table')
      expect(dropResult.sql).toContain('DROP CONSTRAINT')
      expect(dropResult.sql).toContain('CASCADE')

      const dropResponse = await runQuery(dropResult.sql)
      expect(dropResponse.success).toBe(true)

      const structureAfter = await adapter.describeTable('test_schema', 'ddl_test_fk_drop_child')
      const fk = structureAfter.foreignKeys.find((f) => f.constraintName === 'fk_drop_parent')
      expect(fk).toBeUndefined()

      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_drop_child CASCADE')
      await runQuery('DROP TABLE IF EXISTS test_schema.ddl_test_fk_drop_parent CASCADE')
    })
  })
})
