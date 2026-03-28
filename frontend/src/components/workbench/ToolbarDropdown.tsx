import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { Link } from '../catalyst/link'

type ToolbarDropdownProps = {
  children: React.ReactNode
}

export function ToolbarDropdown({ children }: ToolbarDropdownProps) {
  return <Headless.Menu>{children}</Headless.Menu>
}

export function ToolbarDropdownButton({ children, ...props }: Headless.MenuButtonProps<'button'>) {
  return <Headless.MenuButton {...props}>{children}</Headless.MenuButton>
}

/**
 * Split button group: [ Main Action ][ v ]
 * Combines a regular button with a dropdown trigger
 */
type ToolbarSplitButtonGroupProps = {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
  title?: string
  onClick: () => void
  children: React.ReactNode // Dropdown menu items
}

const baseStyles = [
  'inline-flex items-center justify-center gap-1',
  'px-2 py-1',
  'text-xs font-medium',
  'transition-colors',
  'focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400',
]

const defaultStyles = [
  'text-zinc-700 dark:text-zinc-300',
  'hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70',
  'active:bg-zinc-300/70 dark:active:bg-zinc-600/70',
]

export function ToolbarSplitButtonGroup({
  icon: Icon,
  label,
  disabled,
  title,
  onClick,
  children,
}: ToolbarSplitButtonGroupProps) {
  return (
    <div className="inline-flex">
      {/* Main action button */}
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={onClick}
        className={clsx(
          baseStyles,
          'rounded-l border border-r-0 border-zinc-300 dark:border-zinc-600',
          defaultStyles,
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </button>
      {/* Dropdown arrow */}
      <Headless.Menu>
        <Headless.MenuButton
          disabled={disabled}
          className={clsx(
            'inline-flex items-center justify-center',
            'px-1 py-1',
            'rounded-r border border-zinc-300 dark:border-zinc-600',
            'transition-colors',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400',
            defaultStyles,
            disabled && 'opacity-40 cursor-not-allowed',
          )}
        >
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Headless.MenuButton>
        {children}
      </Headless.Menu>
    </div>
  )
}

export function ToolbarDropdownMenu({
  anchor = 'bottom start',
  className,
  ...props
}: { className?: string } & Omit<Headless.MenuItemsProps, 'as' | 'className'>) {
  return (
    <Headless.MenuItems
      {...props}
      transition
      anchor={anchor}
      className={clsx(
        className,
        // Anchor positioning
        '[--anchor-gap:4px] [--anchor-padding:4px]',
        // Base styles
        'z-50 min-w-[140px] rounded-md p-1',
        // Invisible border for accessibility in forced-colors mode
        'outline outline-transparent focus:outline-hidden',
        // Background
        'bg-white dark:bg-zinc-800',
        // Shadow and ring
        'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10',
        // Transitions
        'transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0',
      )}
    />
  )
}

export function ToolbarDropdownItem({
  className,
  ...props
}: { className?: string } & (
  | ({ href?: never } & Omit<Headless.MenuItemProps<'button'>, 'as' | 'className'>)
  | ({ href: string } & Omit<Headless.MenuItemProps<typeof Link>, 'as' | 'className'>)
)) {
  const classes = clsx(
    className,
    // Base styles
    'group flex w-full items-center gap-2 rounded px-2 py-1.5',
    'text-left text-xs',
    'text-zinc-700 dark:text-zinc-300',
    'cursor-default',
    // Focus
    'data-focus:bg-zinc-100 dark:data-focus:bg-zinc-700',
    'data-focus:text-zinc-900 dark:data-focus:text-zinc-100',
    // Disabled
    'data-disabled:opacity-40',
    // Icons
    '*:data-[slot=icon]:h-3.5 *:data-[slot=icon]:w-3.5 *:data-[slot=icon]:text-zinc-500 dark:*:data-[slot=icon]:text-zinc-400',
    'data-focus:*:data-[slot=icon]:text-zinc-700 dark:data-focus:*:data-[slot=icon]:text-zinc-300',
  )

  return typeof props.href === 'string' ? (
    <Headless.MenuItem as={Link} {...props} className={classes} />
  ) : (
    <Headless.MenuItem as="button" type="button" {...props} className={classes} />
  )
}

export function ToolbarDropdownDivider({ className }: { className?: string }) {
  return (
    <Headless.MenuSeparator className={clsx(className, 'my-1 h-px bg-zinc-200 dark:bg-zinc-700')} />
  )
}
