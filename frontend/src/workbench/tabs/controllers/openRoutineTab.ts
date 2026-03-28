import { useTabsStore } from '../useTabsStore'

type OpenRoutineTabParams = {
  schema: string
  objectName: string
  objectType: 'function' | 'procedure'
  preview?: boolean
}

/**
 * Opens a routine (function/procedure) tab. The tab component handles its own data loading.
 * If preview is true, opens as a preview tab (replaces existing preview).
 */
export function openRoutineTab({
  schema,
  objectName,
  objectType,
  preview = false,
}: OpenRoutineTabParams) {
  const tabId = `routine:${schema}.${objectName}:${objectType}`
  const store = useTabsStore.getState()

  const tab = {
    id: tabId,
    title: objectName,
    tabType: 'routine' as const,
    config: { schema, objectName, objectType },
  }

  if (preview) {
    store.addPreviewTab(tab)
  } else {
    store.addTab(tab)
  }
}
