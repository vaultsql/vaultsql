import { useCallback } from 'react'
import { useWorkbench } from '../../context/useWorkbench'
import { useColumnsStore } from './useColumnsStore'
import { useSchemasStore } from './useSchemasStore'

export function useSchemaLoader() {
  const { db } = useWorkbench()

  const loadSchemaNames = useCallback(async () => {
    const { beginLoad, setSchemaNames, setActiveSchema, failLoad } = useSchemasStore.getState()

    beginLoad()

    try {
      const schemaNames = await db.loadSchemaNames()
      setSchemaNames(schemaNames)

      // Auto-select 'public' if available, otherwise first schema
      const defaultSchema = schemaNames.includes('public') ? 'public' : (schemaNames[0] ?? null)

      if (defaultSchema) {
        setActiveSchema(defaultSchema)
      }

      return defaultSchema
    } catch (error) {
      failLoad(error instanceof Error ? error.message : 'Unknown error loading schemas')
      return null
    }
  }, [db])

  const loadSchemaAssets = useCallback(
    async (schemaName: string) => {
      const { beginAssetsLoad, setAssets, failAssetsLoad } = useSchemasStore.getState()

      beginAssetsLoad()

      try {
        const assets = await db.loadSchemaAssets(schemaName)
        setAssets(assets)
      } catch (error) {
        failAssetsLoad(error instanceof Error ? error.message : 'Unknown error loading assets')
      }
    },
    [db],
  )

  const loadAllColumns = useCallback(
    async (schemaName: string) => {
      const { beginLoad, mergeColumns, failLoad } = useColumnsStore.getState()
      beginLoad()

      try {
        const columns = await db.loadAllColumns(schemaName)
        mergeColumns(columns)
      } catch (error) {
        failLoad(error instanceof Error ? error.message : 'Unknown error loading columns')
      }
    },
    [db],
  )

  const loadSchemaObjects = useCallback(
    async (schemaName: string) => {
      const { beginObjectsLoad, setSchemaObjects, failObjectsLoad } = useSchemasStore.getState()

      beginObjectsLoad()

      try {
        const objects = await db.loadSchemaObjects(schemaName)
        setSchemaObjects(objects)
      } catch (error) {
        failObjectsLoad(error instanceof Error ? error.message : 'Unknown error loading objects')
      }
    },
    [db],
  )

  const loadSchema = useCallback(
    async (schemaName: string) => {
      await loadSchemaAssets(schemaName)
      // Fire-and-forget: load columns for autocomplete and schema objects
      void loadAllColumns(schemaName)
      void loadSchemaObjects(schemaName)
    },
    [loadSchemaAssets, loadAllColumns, loadSchemaObjects],
  )

  const initializeSchemas = useCallback(async () => {
    const { status, activeSchema } = useSchemasStore.getState()
    if (status !== 'idle') {
      return activeSchema
    }

    const defaultSchema = await loadSchemaNames()
    if (defaultSchema) {
      await loadSchema(defaultSchema)
    }
    return defaultSchema
  }, [loadSchemaNames, loadSchema])

  return {
    loadSchemaNames,
    loadSchemaAssets,
    loadAllColumns,
    loadSchemaObjects,
    loadSchema,
    initializeSchemas,
  }
}
