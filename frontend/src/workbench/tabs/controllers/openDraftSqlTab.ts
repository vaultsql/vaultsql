import { useTabsStore } from '../useTabsStore'

type OpenDraftSqlTabParams = {
  initialContent?: string
}

/**
 * Opens a new draft SQL tab. The tab starts in draft mode (no worksheetId)
 * and can be saved as a worksheet later.
 *
 * @param params.initialContent - Optional initial SQL content for the draft
 */
export function openDraftSqlTab({ initialContent }: OpenDraftSqlTabParams = {}) {
  const tabId = `draft:${Date.now()}`

  useTabsStore.getState().addTab({
    id: tabId,
    title: 'SQL',
    tabType: 'worksheet',
    config: initialContent ? { initialContent } : {}, // No worksheetId = draft mode
  })
}
