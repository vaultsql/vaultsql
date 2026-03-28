import { type PropsWithChildren, useEffect, useMemo, useState } from 'react'

import { type Theme, ThemeProviderContext } from './theme-context'

type ThemeProviderProps = PropsWithChildren<{
  defaultTheme?: Theme
  storageKey?: string
}>

function getStoredTheme(storageKey: string, defaultTheme: Theme) {
  try {
    const stored = window.localStorage.getItem(storageKey)
    // Treat 'system' as 'dark' for backwards compatibility
    if (stored === 'system') return defaultTheme
    return (stored as Theme) ?? defaultTheme
  } catch {
    return defaultTheme
  }
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'vaultsql-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme
    }
    return getStoredTheme(storageKey, defaultTheme)
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: Theme) => {
        try {
          window.localStorage.setItem(storageKey, nextTheme)
        } catch {
          // Ignore storage failures in restricted environments
        }
        setTheme(nextTheme)
      },
    }),
    [storageKey, theme],
  )

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export type { ThemeProviderProps }
