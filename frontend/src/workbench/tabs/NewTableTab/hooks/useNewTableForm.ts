import { useMemo, useState } from 'react'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import { useSchemaLoader } from '@/workbench/features/schema-browser/useSchemaLoader'
import { useSchemasStore } from '@/workbench/features/schema-browser/useSchemasStore'
import type {
  ColumnDefinition,
  ColumnInfo,
  IndexDefinition,
  WorkbenchAsset,
} from '@/workbench/types/database'
import { openTableTab } from '../../controllers/openTableTab'
import type { TabDescriptor } from '../../useTabsStore'
import { useTabsStore } from '../../useTabsStore'
import {
  createEmptyColumn,
  createEmptyForeignKey,
  createEmptyIndex,
  type FormColumn,
  type FormForeignKey,
  type FormIndex,
} from '../types'

export function useNewTableForm(tab: TabDescriptor) {
  const { db } = useWorkbench()
  const { loadSchemaAssets } = useSchemaLoader()
  const schemaNames = useSchemasStore((state) => state.schemaNames)
  const closeTab = useTabsStore((state) => state.closeTab)

  // Get initial schema from tab config
  const initialSchema = 'schema' in tab.config ? tab.config.schema : 'public'

  // Form state
  const [schema, setSchema] = useState(initialSchema)
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<FormColumn[]>([createEmptyColumn()])
  const [indexes, setIndexes] = useState<FormIndex[]>([])
  const [foreignKeys, setForeignKeys] = useState<FormForeignKey[]>([])

  // Collapsible sections
  const [indexesOpen, setIndexesOpen] = useState(false)
  const [foreignKeysOpen, setForeignKeysOpen] = useState(false)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // FK reference data
  const [refTables, setRefTables] = useState<Map<string, WorkbenchAsset[]>>(new Map())
  const [refColumns, setRefColumns] = useState<Map<string, ColumnInfo[]>>(new Map())

  // Build column definitions for DDL
  const columnDefinitions: ColumnDefinition[] = useMemo(() => {
    return columns
      .filter((col) => col.name.trim())
      .map((col) => ({
        name: col.name.trim(),
        dataType: col.dataType,
        primaryKey: col.primaryKey,
        nullable: !col.notNull,
        unique: col.unique,
        defaultValue: col.defaultValue.trim() || undefined,
      }))
  }, [columns])

  // Build index definitions
  const indexDefinitions: IndexDefinition[] = useMemo(() => {
    return indexes
      .filter((idx) => idx.columns.length > 0)
      .map((idx) => ({
        name: idx.name.trim() || undefined,
        columns: idx.columns,
        unique: idx.unique,
      }))
  }, [indexes])

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    if (!tableName.trim() || columnDefinitions.length === 0) {
      return null
    }

    try {
      const result = db.buildCreateTableQuery({
        schema: schema || 'public',
        table: tableName.trim(),
        columns: columnDefinitions,
        indexes: indexDefinitions.length > 0 ? indexDefinitions : undefined,
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, tableName, columnDefinitions, indexDefinitions])

  // Get available column names for indexes/foreign keys
  const availableColumns = useMemo(
    () => columns.filter((col) => col.name.trim()).map((col) => col.name.trim()),
    [columns],
  )

  const isValid = tableName.trim() && columnDefinitions.length > 0

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tableName.trim()) {
      setError('Table name is required')
      return
    }

    if (columnDefinitions.length === 0) {
      setError('At least one column is required')
      return
    }

    if (!sqlPreview || sqlPreview.startsWith('--')) {
      setError('Invalid table configuration')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Execute CREATE TABLE
      const response = await db.query(sqlPreview, {
        actor: 'table',
        operation: 'create_table',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to create table')
        setIsSubmitting(false)
        return
      }

      // Execute foreign key constraints separately
      for (const fk of foreignKeys) {
        if (!fk.column || !fk.refSchema || !fk.refTable || !fk.refColumn) continue

        const fkResult = db.buildAddForeignKeyQuery({
          schema: schema || 'public',
          table: tableName.trim(),
          column: fk.column,
          refSchema: fk.refSchema,
          refTable: fk.refTable,
          refColumn: fk.refColumn,
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate,
        })

        const fkResponse = await db.query(fkResult.sql, {
          actor: 'table',
          operation: 'add_foreign_key',
        })

        if (!fkResponse.success) {
          setError(`Table created but foreign key failed: ${fkResponse.error}`)
          setIsSubmitting(false)
          // Still refresh since table was created
          await loadSchemaAssets(schema || 'public')
          return
        }
      }

      // Refresh schema assets
      await loadSchemaAssets(schema || 'public')

      // Close this tab and open the new table
      closeTab(tab.id)
      openTableTab({ schema: schema || 'public', table: tableName.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Column handlers
  const addColumn = () => {
    setColumns((prev) => [...prev, createEmptyColumn()])
  }

  const removeColumn = (id: string) => {
    setColumns((prev) => prev.filter((col) => col.id !== id))
  }

  const updateColumn = (id: string, updates: Partial<FormColumn>) => {
    setColumns((prev) => prev.map((col) => (col.id === id ? { ...col, ...updates } : col)))
  }

  // Index handlers
  const addIndex = () => {
    setIndexes((prev) => [...prev, createEmptyIndex()])
    setIndexesOpen(true)
  }

  const removeIndex = (id: string) => {
    setIndexes((prev) => prev.filter((idx) => idx.id !== id))
  }

  const updateIndex = (id: string, updates: Partial<FormIndex>) => {
    setIndexes((prev) => prev.map((idx) => (idx.id === id ? { ...idx, ...updates } : idx)))
  }

  const toggleIndexColumn = (indexId: string, columnName: string) => {
    setIndexes((prev) =>
      prev.map((idx) => {
        if (idx.id !== indexId) return idx
        const isSelected = idx.columns.includes(columnName)
        return {
          ...idx,
          columns: isSelected
            ? idx.columns.filter((c) => c !== columnName)
            : [...idx.columns, columnName],
        }
      }),
    )
  }

  // Foreign key handlers
  const addForeignKey = () => {
    setForeignKeys((prev) => [...prev, { ...createEmptyForeignKey(), refSchema: schema }])
    setForeignKeysOpen(true)
  }

  const removeForeignKey = (id: string) => {
    setForeignKeys((prev) => prev.filter((fk) => fk.id !== id))
  }

  const updateForeignKey = (id: string, updates: Partial<FormForeignKey>) => {
    setForeignKeys((prev) => prev.map((fk) => (fk.id === id ? { ...fk, ...updates } : fk)))
  }

  // Load reference tables when schema changes
  const loadRefTables = async (schemaName: string) => {
    if (refTables.has(schemaName)) return

    try {
      const assets = await db.loadSchemaAssets(schemaName)
      const tables = assets.filter((a) => a.type === 'table')
      setRefTables((prev) => new Map(prev).set(schemaName, tables))
    } catch {
      // Ignore errors
    }
  }

  // Load reference columns when table changes
  const loadRefColumnsData = async (schemaName: string, refTableName: string) => {
    const key = `${schemaName}.${refTableName}`
    if (refColumns.has(key)) return

    try {
      const structure = await db.describeTable(schemaName, refTableName)
      setRefColumns((prev) => new Map(prev).set(key, structure.columns))
    } catch {
      // Ignore errors
    }
  }

  return {
    // Form state
    schema,
    setSchema,
    tableName,
    setTableName,
    columns,
    indexes,
    foreignKeys,
    schemaNames,

    // Collapsible sections
    indexesOpen,
    setIndexesOpen,
    foreignKeysOpen,
    setForeignKeysOpen,

    // Submission state
    isSubmitting,
    error,
    setError,

    // Derived values
    columnDefinitions,
    indexDefinitions,
    sqlPreview,
    availableColumns,
    isValid,

    // Column handlers
    addColumn,
    removeColumn,
    updateColumn,

    // Index handlers
    addIndex,
    removeIndex,
    updateIndex,
    toggleIndexColumn,

    // Foreign key handlers
    addForeignKey,
    removeForeignKey,
    updateForeignKey,

    // Reference data
    refTables,
    refColumns,
    loadRefTables,
    loadRefColumnsData,

    // Form handlers
    handleSubmit,
    handleCancel: () => closeTab(tab.id),
  }
}
