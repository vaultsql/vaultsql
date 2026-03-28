import clsx from 'clsx'
import { ChevronRightIcon } from 'lucide-react'

type StatusBarItemProps = {
  icon?: React.ComponentType<{ className?: string }>
  label?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
  showChevron?: boolean
}

export function StatusBarItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
  showChevron,
}: StatusBarItemProps) {
  const isClickable = !!onClick && !disabled

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={clsx(
        'wb-statusbar-item',
        isClickable && 'wb-statusbar-item-clickable',
        !isClickable && 'cursor-default',
        disabled && 'opacity-50',
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label && <span>{label}</span>}
      {isClickable && showChevron && <ChevronRightIcon className="h-3 w-3 opacity-50" />}
    </button>
  )
}
