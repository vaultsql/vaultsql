import { useHotkeys } from 'react-hotkeys-hook'
import { useTabsStore } from '../tabs/useTabsStore'

export function useWorkbenchShortcuts() {
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const closeTab = useTabsStore((state) => state.closeTab)

  // Cmd+W / Ctrl+W - Close active tab
  useHotkeys(
    'mod+w',
    (e) => {
      e.preventDefault()
      if (activeTabId) {
        closeTab(activeTabId)
      }
    },
    { enableOnFormTags: false },
  )
}
