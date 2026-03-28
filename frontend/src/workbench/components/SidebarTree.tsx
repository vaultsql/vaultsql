import {
  CircleStackIcon,
  DocumentTextIcon,
  ChevronRightIcon as HeroChevronRightIcon,
  FolderIcon as HeroFolderIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { type ReactNode, useState } from 'react'

interface SidebarTreeProps {
  children: ReactNode
  className?: string
}

export function SidebarTree({ children, className = '' }: SidebarTreeProps) {
  return <ul className={`${className}`}>{children}</ul>
}

interface SidebarTreeGroupProps {
  label: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function SidebarTreeGroup({
  label,
  icon,
  children,
  defaultOpen = false,
  className,
}: SidebarTreeGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <li>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx('wb-tree-group', className)}
      >
        <span
          className={`flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
        >
          <ChevronRightIcon className="h-3 w-3" />
        </span>
        {icon && <span className="flex-shrink-0 wb-tree-icon">{icon}</span>}
        <span className="truncate">{label}</span>
      </button>
      {isOpen && <ul className="ml-5">{children}</ul>}
    </li>
  )
}

interface SidebarTreeItemProps {
  label: string
  icon?: ReactNode
  isActive?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  secondaryLabel?: string
}

export function SidebarTreeItem({
  label,
  icon,
  isActive,
  onClick,
  onDoubleClick,
  secondaryLabel,
}: SidebarTreeItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`wb-tree-row transition-colors ${isActive ? 'wb-tree-row-active' : 'wb-tree-row-inactive'}`}
      >
        {icon && (
          <span className={isActive ? 'text-foreground wb-tree-icon' : 'wb-tree-icon'}>{icon}</span>
        )}
        <span className="truncate flex-1 text-left font-mono">{label}</span>
        {secondaryLabel && (
          <span className="text-[11px] text-muted-foreground">{secondaryLabel}</span>
        )}
      </button>
    </li>
  )
}

// Icons
export function ChevronRightIcon({ className }: { className?: string }) {
  return <HeroChevronRightIcon className={className} />
}

export function TableIcon({ className }: { className?: string }) {
  return <TableCellsIcon className={className} />
}

export function DatabaseIcon({ className }: { className?: string }) {
  return <CircleStackIcon className={className} />
}

export function FileIcon({ className }: { className?: string }) {
  return <DocumentTextIcon className={className} />
}

export function FolderIcon({ className }: { className?: string }) {
  return <HeroFolderIcon className={className} />
}
