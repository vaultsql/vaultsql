import { useEffect } from 'react'

const APP_NAME = 'VaultSQL'

/**
 * Hook to set the page title dynamically
 * @param title - The page-specific title. If provided, formats as "Title - VaultSQL"
 * @param skipAppName - If true, uses only the provided title without appending app name
 */
export function usePageTitle(title?: string, skipAppName = false) {
  useEffect(() => {
    if (!title) {
      document.title = APP_NAME
      return
    }

    document.title = skipAppName ? title : `${title} - ${APP_NAME}`

    return () => {
      document.title = APP_NAME
    }
  }, [title, skipAppName])
}
