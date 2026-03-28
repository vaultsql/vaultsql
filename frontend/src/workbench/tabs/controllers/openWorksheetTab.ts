import { useTabsStore } from '../useTabsStore'

type OpenWorksheetTabParams = {
  worksheetId: string
  worksheetName: string
  preview?: boolean
}

/**
 * Opens a worksheet tab. The tab component handles its own state.
 * If preview is true, opens as a preview tab (replaces existing preview).
 */
export function openWorksheetTab({
  worksheetId,
  worksheetName,
  preview = false,
}: OpenWorksheetTabParams) {
  const tabId = `worksheet:${worksheetId}`
  const store = useTabsStore.getState()

  const tab = {
    id: tabId,
    title: worksheetName,
    tabType: 'worksheet' as const,
    config: { worksheetId },
  }

  if (preview) {
    store.addPreviewTab(tab)
  } else {
    store.addTab(tab)
  }
}
