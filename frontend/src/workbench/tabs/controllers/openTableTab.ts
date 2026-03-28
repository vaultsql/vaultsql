import type { FilterInput } from '@/workbench/types/database'
import { useTabsStore } from '../useTabsStore'

type OpenTableTabParams = {
  schema: string
  table: string
  isView?: boolean
  filters?: FilterInput[]
  preview?: boolean
}

/**
 * Opens a table tab. The tab component handles its own data loading.
 * If the tab already exists, resets its filters to the provided values.
 * If preview is true, opens as a preview tab (replaces existing preview).
 */
export function openTableTab({
  schema,
  table,
  isView,
  filters,
  preview = false,
}: OpenTableTabParams) {
  const tabId = `table:${schema}.${table}`
  const store = useTabsStore.getState()
  const existingTab = store.tabs.find((t) => t.id === tabId)

  if (existingTab) {
    store.resetTabFilters(tabId, filters ?? [])
  } else {
    const tab = {
      id: tabId,
      title: table,
      tabType: 'browse-data' as const,
      config: { schema, table, isView, filters },
    }

    if (preview) {
      store.addPreviewTab(tab)
    } else {
      store.addTab(tab)
    }
  }
}
