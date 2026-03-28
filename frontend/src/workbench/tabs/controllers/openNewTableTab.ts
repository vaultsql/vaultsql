import { useTabsStore } from '../useTabsStore'

type OpenNewTableTabParams = {
  schema: string
}

/**
 * Opens a new table design tab.
 * If a tab for this schema already exists, it will be selected.
 */
export function openNewTableTab({ schema }: OpenNewTableTabParams) {
  const tabId = `new-table:${schema}`
  const store = useTabsStore.getState()
  const existingTab = store.tabs.find((t) => t.id === tabId)

  if (existingTab) {
    store.selectTab(tabId)
  } else {
    store.addTab({
      id: tabId,
      title: 'New Table',
      tabType: 'new-table',
      config: { schema },
    })
  }
}
