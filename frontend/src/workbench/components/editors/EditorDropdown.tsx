import * as Headless from '@headlessui/react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'

type EditorDropdownProps = {
  onSetNull: () => void
  onSetDefault: () => void
  onCancel: () => void
  compact?: boolean
  disabled?: boolean
  hasDefault?: boolean
  nullable?: boolean
}

/**
 * Dropdown menu for cell editor with Set NULL, Set Default, and Cancel actions.
 * Attached to the right edge of the input field.
 */
export function EditorDropdown({
  onSetNull,
  onSetDefault,
  onCancel,
  compact = false,
  disabled = false,
  hasDefault = true,
  nullable = true,
}: EditorDropdownProps) {
  return (
    <Headless.Menu>
      <Headless.MenuButton
        disabled={disabled}
        className={clsx(
          'inline-flex items-center justify-center',
          compact ? 'px-1.5 py-0.5' : 'px-2 py-1',
          'rounded-r border border-l-0 border-border bg-muted/30',
          'transition-colors',
          'hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        <ChevronDown className="h-3.5 w-3.5 text-foreground/70" />
      </Headless.MenuButton>
      <Headless.MenuItems
        transition
        anchor="bottom end"
        className={clsx(
          // Anchor positioning
          '[--anchor-gap:4px] [--anchor-padding:4px]',
          // Base styles
          'z-50 min-w-[140px] rounded-md p-1',
          // Background
          'bg-white dark:bg-zinc-800',
          // Shadow and ring
          'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10',
          // Transitions
          'transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0',
          // Focus
          'outline outline-transparent focus:outline-hidden',
        )}
      >
        {nullable && (
          <Headless.MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={onSetNull}
                className={clsx(
                  'group flex w-full items-center rounded px-2 py-1.5 text-xs',
                  focus
                    ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-700 dark:text-zinc-300',
                )}
              >
                Set NULL
              </button>
            )}
          </Headless.MenuItem>
        )}
        {hasDefault && (
          <Headless.MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={onSetDefault}
                className={clsx(
                  'group flex w-full items-center rounded px-2 py-1.5 text-xs',
                  focus
                    ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-700 dark:text-zinc-300',
                )}
              >
                Set Default
              </button>
            )}
          </Headless.MenuItem>
        )}
        <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        <Headless.MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onCancel}
              className={clsx(
                'group flex w-full items-center rounded px-2 py-1.5 text-xs',
                focus
                  ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-700 dark:text-zinc-300',
              )}
            >
              Cancel
            </button>
          )}
        </Headless.MenuItem>
      </Headless.MenuItems>
    </Headless.Menu>
  )
}
