// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { setupMySQLAdapter } from '@/test/mysqlAdapterTestHarness'

const { getAdapterOrThrow, skipIfNoDb } = setupMySQLAdapter()

describe('MySQLAdapter DDL operations', () => {
  describe('buildCreateTableQuery', () => {
    it('builds basic CREATE TABLE query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [
          { name: 'id', dataType: 'INT', primaryKey: true, nullable: false },
          { name: 'name', dataType: 'VARCHAR(100)', nullable: false },
          { name: 'description', dataType: 'TEXT', nullable: true },
        ],
      })

      expect(result.sql).toContain('CREATE TABLE `test_schema`.`test_table`')
      expect(result.sql).toContain('`id` INT PRIMARY KEY NOT NULL')
      expect(result.sql).toContain('`name` VARCHAR(100) NOT NULL')
      expect(result.sql).toContain('`description` TEXT')
      expect(result.operation).toBe('create_table')
    })

    it('handles IF NOT EXISTS clause', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [{ name: 'id', dataType: 'INT', primaryKey: true }],
        ifNotExists: true,
      })

      expect(result.sql).toContain('CREATE TABLE IF NOT EXISTS')
    })

    it('handles composite primary keys', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [
          { name: 'id1', dataType: 'INT', primaryKey: true },
          { name: 'id2', dataType: 'INT', primaryKey: true },
        ],
      })

      expect(result.sql).toContain('PRIMARY KEY (`id1`, `id2`)')
    })

    it('handles default values', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [
          { name: 'id', dataType: 'INT', primaryKey: true },
          { name: 'status', dataType: 'VARCHAR(20)', defaultValue: "'active'" },
        ],
      })

      expect(result.sql).toContain("`status` VARCHAR(20) DEFAULT 'active'")
    })

    it('handles UNIQUE constraint', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [
          { name: 'id', dataType: 'INT', primaryKey: true },
          { name: 'email', dataType: 'VARCHAR(255)', unique: true },
        ],
      })

      expect(result.sql).toContain('`email` VARCHAR(255) UNIQUE')
    })

    it('handles foreign key references', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [
          { name: 'id', dataType: 'INT', primaryKey: true },
          {
            name: 'user_id',
            dataType: 'INT',
            references: {
              schema: 'test_schema',
              table: 'users',
              column: 'id',
              onDelete: 'CASCADE',
            },
          },
        ],
      })

      expect(result.sql).toContain('REFERENCES `test_schema`.`users`(`id`)')
      expect(result.sql).toContain('ON DELETE CASCADE')
    })

    it('handles CHECK constraints', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [
          { name: 'id', dataType: 'INT', primaryKey: true },
          { name: 'age', dataType: 'INT', check: 'age >= 0' },
        ],
      })

      expect(result.sql).toContain('CHECK (age >= 0)')
    })

    it('handles indexes', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        columns: [
          { name: 'id', dataType: 'INT', primaryKey: true },
          { name: 'email', dataType: 'VARCHAR(255)' },
        ],
        indexes: [{ name: 'idx_email', columns: ['email'], unique: false }],
      })

      expect(result.sql).toContain('CREATE INDEX `idx_email`')
      expect(result.sql).toContain('ON `test_schema`.`test_table` (`email`)')
    })
  })

  describe('buildDropTableQuery', () => {
    it('builds basic DROP TABLE query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildDropTableQuery({
        schema: 'test_schema',
        table: 'test_table',
      })

      expect(result.sql).toBe('DROP TABLE `test_schema`.`test_table`')
      expect(result.operation).toBe('drop_table')
    })

    it('handles IF EXISTS clause', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildDropTableQuery({
        schema: 'test_schema',
        table: 'test_table',
        ifExists: true,
      })

      expect(result.sql).toContain('DROP TABLE IF EXISTS')
    })
  })

  describe('buildTruncateTableQuery', () => {
    it('builds TRUNCATE TABLE query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildTruncateTableQuery({
        schema: 'test_schema',
        table: 'test_table',
      })

      expect(result.sql).toBe('TRUNCATE TABLE `test_schema`.`test_table`')
      expect(result.operation).toBe('truncate_table')
    })
  })

  describe('buildRenameTableQuery', () => {
    it('builds RENAME TABLE query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildRenameTableQuery({
        schema: 'test_schema',
        table: 'old_table',
        newName: 'new_table',
      })

      expect(result.sql).toBe('RENAME TABLE `test_schema`.`old_table` TO `test_schema`.`new_table`')
      expect(result.operation).toBe('alter_table')
    })
  })

  describe('buildAddColumnQuery', () => {
    it('builds ADD COLUMN query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildAddColumnQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: { name: 'new_column', dataType: 'VARCHAR(100)', nullable: true },
      })

      expect(result.sql).toBe(
        'ALTER TABLE `test_schema`.`test_table` ADD COLUMN `new_column` VARCHAR(100)',
      )
      expect(result.operation).toBe('alter_table')
    })
  })

  describe('buildDropColumnQuery', () => {
    it('builds DROP COLUMN query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildDropColumnQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: 'old_column',
      })

      expect(result.sql).toBe('ALTER TABLE `test_schema`.`test_table` DROP COLUMN `old_column`')
      expect(result.operation).toBe('alter_table')
    })
  })

  describe('buildRenameColumnQuery', () => {
    it('builds RENAME COLUMN query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildRenameColumnQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: 'old_name',
        newName: 'new_name',
      })

      expect(result.sql).toBe(
        'ALTER TABLE `test_schema`.`test_table` RENAME COLUMN `old_name` TO `new_name`',
      )
      expect(result.operation).toBe('alter_table')
    })
  })

  describe('buildAlterColumnQuery', () => {
    it('builds ALTER COLUMN query for data type change', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: 'my_column',
        dataType: 'TEXT',
      })

      expect(result.sql).toContain('ALTER TABLE `test_schema`.`test_table`')
      expect(result.sql).toContain('MODIFY COLUMN `my_column` TEXT')
      expect(result.operation).toBe('alter_table')
    })

    it('builds ALTER COLUMN query for nullable change', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: 'my_column',
        dataType: 'VARCHAR(100)',
        nullable: false,
      })

      expect(result.sql).toContain('MODIFY COLUMN `my_column` VARCHAR(100) NOT NULL')
    })

    it('builds ALTER COLUMN query for default value', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: 'my_column',
        defaultValue: "'active'",
      })

      expect(result.sql).toContain("ALTER COLUMN `my_column` SET DEFAULT 'active'")
    })

    it('builds ALTER COLUMN query to drop default', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildAlterColumnQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: 'my_column',
        defaultValue: null,
      })

      expect(result.sql).toContain('ALTER COLUMN `my_column` DROP DEFAULT')
    })
  })

  describe('buildCreateIndexQuery', () => {
    it('builds CREATE INDEX query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateIndexQuery({
        schema: 'test_schema',
        table: 'test_table',
        index: { name: 'idx_test', columns: ['column1', 'column2'], unique: false },
      })

      expect(result.sql).toContain('CREATE INDEX `idx_test`')
      expect(result.sql).toContain('ON `test_schema`.`test_table` (`column1`, `column2`)')
      expect(result.operation).toBe('create_index')
    })

    it('builds CREATE UNIQUE INDEX query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildCreateIndexQuery({
        schema: 'test_schema',
        table: 'test_table',
        index: { columns: ['email'], unique: true },
      })

      expect(result.sql).toContain('CREATE UNIQUE INDEX')
    })
  })

  describe('buildDropIndexQuery', () => {
    it('builds DROP INDEX query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildDropIndexQuery({
        schema: 'test_schema',
        table: 'test_table',
        indexName: 'idx_test',
      })

      expect(result.sql).toBe('DROP INDEX `idx_test` ON `test_schema`.`test_table`')
      expect(result.operation).toBe('drop_index')
    })
  })

  describe('buildAddForeignKeyQuery', () => {
    it('builds ADD FOREIGN KEY query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildAddForeignKeyQuery({
        schema: 'test_schema',
        table: 'test_table',
        column: 'user_id',
        refSchema: 'test_schema',
        refTable: 'users',
        refColumn: 'id',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      })

      expect(result.sql).toContain('ALTER TABLE `test_schema`.`test_table`')
      expect(result.sql).toContain('ADD CONSTRAINT')
      expect(result.sql).toContain('FOREIGN KEY (`user_id`)')
      expect(result.sql).toContain('REFERENCES `test_schema`.`users`(`id`)')
      expect(result.sql).toContain('ON DELETE CASCADE')
      expect(result.sql).toContain('ON UPDATE NO ACTION')
      expect(result.operation).toBe('alter_table')
    })
  })

  describe('buildDropForeignKeyQuery', () => {
    it('builds DROP FOREIGN KEY query', () => {
      if (skipIfNoDb()) {
        return
      }

      const adapter = getAdapterOrThrow()
      const result = adapter.buildDropForeignKeyQuery({
        schema: 'test_schema',
        table: 'test_table',
        constraintName: 'fk_user_id',
      })

      expect(result.sql).toBe(
        'ALTER TABLE `test_schema`.`test_table` DROP FOREIGN KEY `fk_user_id`',
      )
      expect(result.operation).toBe('alter_table')
    })
  })
})
