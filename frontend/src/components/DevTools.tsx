import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/components/use-theme'

// Enable dev tools based on environment (always on for now, can be changed later)
const DEV_TOOLS_ENABLED = true

type DevToolAction = {
  id: string
  label: string
  description?: string
  action: () => Promise<void> | void
  dangerous?: boolean
}

type DevToolSection = {
  id: string
  title: string
  actions: DevToolAction[]
}

/**
 * Registry for dev tool sections - allows extending from other modules
 */
const devToolSections: DevToolSection[] = []

export function registerDevToolSection(section: DevToolSection) {
  const existing = devToolSections.findIndex((s) => s.id === section.id)
  if (existing >= 0) {
    devToolSections[existing] = section
  } else {
    devToolSections.push(section)
  }
}

// ... (existing static registrations)

function DevToolButton({ action }: { action: DevToolAction }) {
  const [isRunning, setIsRunning] = useState(false)

  const handleClick = useCallback(async () => {
    setIsRunning(true)
    try {
      await action.action()
    } catch (err) {
      console.error(`[DevTools] Error in ${action.id}:`, err)
    } finally {
      setIsRunning(false)
    }
  }, [action])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isRunning}
      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
        action.dangerous ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-zinc-700 text-zinc-300'
      } disabled:opacity-50`}
    >
      <div className="font-medium">{action.label}</div>
      {action.description && (
        <div className="text-xs text-zinc-500 mt-0.5">{action.description}</div>
      )}
    </button>
  )
}

function DevToolPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed bottom-16 right-4 w-80 max-h-[70vh] overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-[9999]">
      <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-zinc-100">Dev Tools</span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="p-2 space-y-4">
        {devToolSections.map((section) => (
          <div key={section.id}>
            <div className="px-3 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.actions.map((action) => (
                <DevToolButton key={action.id} action={action} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-700 px-4 py-2 text-xs text-zinc-600">
        Check console for output
      </div>
    </div>
  )
}

export function DevTools({ children }: { children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    registerDevToolSection({
      id: 'theme',
      title: 'Theme',
      actions: [
        {
          id: 'toggle-theme',
          label: `Toggle Theme (${theme})`,
          description: 'Switch between light and dark mode',
          action: () => {
            setTheme(theme === 'dark' ? 'light' : 'dark')
          },
        },
      ],
    })
  }, [theme, setTheme])

  if (!DEV_TOOLS_ENABLED) {
    return <>{children}</>
  }

  return (
    <>
      {children}

      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 w-12 h-12 rounded-full shadow-lg z-[9999] flex items-center justify-center transition-all ${
          isOpen
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-600'
        }`}
        title="Developer Tools"
      >
        <svg
          className="w-6 h-6 text-zinc-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Panel */}
      {isOpen && <DevToolPanel onClose={() => setIsOpen(false)} />}
    </>
  )
}

// Re-export for extensibility
export type { DevToolAction, DevToolSection }
