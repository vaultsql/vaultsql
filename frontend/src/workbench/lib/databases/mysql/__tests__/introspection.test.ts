// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseColumns } from '../introspection'

describe('MySQL introspection', () => {
  describe('parseColumns', () => {
    it('correctly identifies primary key when is_primary_key is numeric', () => {
      const rows = [
        {
          column_name: 'id',
          data_type: 'int',
          column_type: 'int(11)',
          is_nullable: 'NO',
          column_default: null,
          column_key: 'PRI',
          extra: 'auto_increment',
          column_comment: '',
          is_primary_key: 1, // numeric 1
        },
        {
          column_name: 'name',
          data_type: 'varchar',
          column_type: 'varchar(255)',
          is_nullable: 'YES',
          column_default: null,
          column_key: '',
          extra: '',
          column_comment: '',
          is_primary_key: 0, // numeric 0
        },
      ]

      const columns = parseColumns(rows)

      expect(columns[0].isPrimaryKey).toBe(true)
      expect(columns[1].isPrimaryKey).toBe(false)
    })

    it('correctly identifies primary key when is_primary_key is string', () => {
      const rows = [
        {
          column_name: 'id',
          data_type: 'int',
          column_type: 'int(11)',
          is_nullable: 'NO',
          column_default: null,
          column_key: 'PRI',
          extra: 'auto_increment',
          column_comment: '',
          is_primary_key: '1', // string "1"
        },
        {
          column_name: 'name',
          data_type: 'varchar',
          column_type: 'varchar(255)',
          is_nullable: 'YES',
          column_default: null,
          column_key: '',
          extra: '',
          column_comment: '',
          is_primary_key: '0', // string "0" - this was the bug!
        },
      ]

      const columns = parseColumns(rows)

      expect(columns[0].isPrimaryKey).toBe(true)
      expect(columns[1].isPrimaryKey).toBe(false)
    })

    it('falls back to column_key=PRI when is_primary_key is 0', () => {
      const rows = [
        {
          column_name: 'id',
          data_type: 'int',
          column_type: 'int(11)',
          is_nullable: 'NO',
          column_default: null,
          column_key: 'PRI',
          extra: 'auto_increment',
          column_comment: '',
          is_primary_key: 0,
        },
      ]

      const columns = parseColumns(rows)

      expect(columns[0].isPrimaryKey).toBe(true)
    })
  })
})
