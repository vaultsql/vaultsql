import { create } from 'zustand'
import type { SchemaObject, WorkbenchAsset } from '@/workbench/types/database'

export type WorkbenchTableType = 'table' | 'view'

type SchemasStatus = 'idle' | 'loading' | 'success' | 'error'

type SchemasStoreState = {
  schemaNames: string[]
  activeSchema: string | null
  assets: WorkbenchAsset[]
  schemaObjects: SchemaObject[]
  status: SchemasStatus
  assetsStatus: SchemasStatus
  objectsStatus: SchemasStatus
  error: string | null
}

type SchemasStoreActions = {
  beginLoad: () => void
  setSchemaNames: (names: string[]) => void
  setActiveSchema: (name: string) => void
  beginAssetsLoad: () => void
  setAssets: (assets: WorkbenchAsset[]) => void
  beginObjectsLoad: () => void
  setSchemaObjects: (objects: SchemaObject[]) => void
  failLoad: (error: string) => void
  failAssetsLoad: (error: string) => void
  failObjectsLoad: (error: string) => void
}

export type SchemasStore = SchemasStoreState & SchemasStoreActions

export const useSchemasStore = create<SchemasStore>((set) => ({
  schemaNames: [],
  activeSchema: null,
  assets: [],
  schemaObjects: [],
  status: 'idle',
  assetsStatus: 'idle',
  objectsStatus: 'idle',
  error: null,

  beginLoad: () =>
    set({
      status: 'loading',
      error: null,
    }),
  setSchemaNames: (schemaNames) =>
    set({
      schemaNames,
      status: 'success',
      error: null,
    }),
  setActiveSchema: (activeSchema) =>
    set({
      activeSchema,
      assets: [],
      schemaObjects: [],
      assetsStatus: 'idle',
      objectsStatus: 'idle',
    }),
  beginAssetsLoad: () =>
    set({
      assetsStatus: 'loading',
    }),
  setAssets: (assets) =>
    set({
      assets,
      assetsStatus: 'success',
    }),
  beginObjectsLoad: () =>
    set({
      objectsStatus: 'loading',
    }),
  setSchemaObjects: (schemaObjects) =>
    set({
      schemaObjects,
      objectsStatus: 'success',
    }),
  failLoad: (error) =>
    set({
      status: 'error',
      error,
    }),
  failAssetsLoad: (error) =>
    set({
      assetsStatus: 'error',
      error,
    }),
  failObjectsLoad: (error) =>
    set({
      objectsStatus: 'error',
      error,
    }),
}))
