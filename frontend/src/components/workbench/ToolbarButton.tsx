import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { forwardRef } from 'react'

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

const activeStyles = ['bg-zinc-200 dark:bg-zinc-700', 'text-zinc-900 dark:text-zinc-100']

type ToolbarButtonProps = {
  icon?: React.ComponentType<{ className?: string }>
  label?: string
  hasDropdown?: boolean
  disabled?: boolean
  active?: boolean
  className?: string
  title?: string
  onClick?: () => void
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    { icon: Icon, label, hasDropdown, disabled, active, className, title, onClick, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        title={title}
        onClick={onClick}
        className={clsx(
          baseStyles,
          'rounded border border-zinc-300 dark:border-zinc-600',
          !active && defaultStyles,
          active && activeStyles,
          disabled && 'opacity-40 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label && <span>{label}</span>}
        {hasDropdown && <ChevronDown className="h-3 w-3 opacity-60" />}
      </button>
    )
  },
)

/**
 * Split button: [ Main Action ][ v ]
 * Main button triggers primary action, dropdown arrow opens menu
 */
type ToolbarSplitButtonProps = {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
  title?: string
  onClick: () => void
  className?: string
}

export const ToolbarSplitButton = forwardRef<HTMLDivElement, ToolbarSplitButtonProps>(
  function ToolbarSplitButton({ icon: Icon, label, disabled, title, onClick, className }, ref) {
    return (
      <div ref={ref} className={clsx('inline-flex', className)}>
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
      </div>
    )
  },
)

/**
 * The dropdown arrow portion of a split button
 * Use inside ToolbarDropdownButton
 */
export const ToolbarSplitArrow = forwardRef<
  HTMLButtonElement,
  { disabled?: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>
>(function ToolbarSplitArrow({ disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center',
        'px-1 py-1',
        'rounded-r border border-l-0 border-zinc-300 dark:border-zinc-600',
        'transition-colors',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400',
        defaultStyles,
        disabled && 'opacity-40 cursor-not-allowed',
      )}
      {...props}
    >
      <ChevronDown className="h-3 w-3 opacity-60" />
    </button>
  )
})
