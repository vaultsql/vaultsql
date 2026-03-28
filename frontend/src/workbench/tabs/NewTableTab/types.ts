import type { ForeignKeyAction } from '@/workbench/types/database'

// Common PostgreSQL data types
export const COMMON_DATA_TYPES = [
  { value: 'SERIAL', label: 'SERIAL (auto-increment)' },
  { value: 'BIGSERIAL', label: 'BIGSERIAL (auto-increment)' },
  { value: 'INTEGER', label: 'INTEGER' },
  { value: 'BIGINT', label: 'BIGINT' },
  { value: 'SMALLINT', label: 'SMALLINT' },
  { value: 'VARCHAR(255)', label: 'VARCHAR(255)' },
  { value: 'TEXT', label: 'TEXT' },
  { value: 'BOOLEAN', label: 'BOOLEAN' },
  { value: 'TIMESTAMP', label: 'TIMESTAMP' },
  { value: 'TIMESTAMPTZ', label: 'TIMESTAMPTZ' },
  { value: 'DATE', label: 'DATE' },
  { value: 'NUMERIC', label: 'NUMERIC' },
  { value: 'UUID', label: 'UUID' },
  { value: 'JSONB', label: 'JSONB' },
]

export const FK_ACTIONS: ForeignKeyAction[] = ['NO ACTION', 'CASCADE', 'SET NULL', 'RESTRICT']

// Form column state (UI representation)
export type FormColumn = {
  id: string
  name: string
  dataType: string
  primaryKey: boolean
  notNull: boolean
  unique: boolean
  defaultValue: string
}

// Form index state
export type FormIndex = {
  id: string
  name: string
  columns: string[]
  unique: boolean
}

// Form foreign key state
export type FormForeignKey = {
  id: string
  column: string
  refSchema: string
  refTable: string
  refColumn: string
  onDelete: ForeignKeyAction
  onUpdate: ForeignKeyAction
}

export function createEmptyColumn(): FormColumn {
  return {
    id: crypto.randomUUID(),
    name: '',
    dataType: 'INTEGER',
    primaryKey: false,
    notNull: false,
    unique: false,
    defaultValue: '',
  }
}

export function createEmptyIndex(): FormIndex {
  return {
    id: crypto.randomUUID(),
    name: '',
    columns: [],
    unique: false,
  }
}

export function createEmptyForeignKey(): FormForeignKey {
  return {
    id: crypto.randomUUID(),
    column: '',
    refSchema: '',
    refTable: '',
    refColumn: '',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  }
}
