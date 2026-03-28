import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import type { GridContextMenuItem } from './types'

type GridContextMenuProps = {
  isOpen: boolean
  items: GridContextMenuItem[]
  position: { x: number; y: number } | null
  onClose: () => void
}

export function GridContextMenu({ isOpen, items, position, onClose }: GridContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return
      onClose()
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  if (!isOpen || !position || items.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-44 rounded-xl bg-white/85 p-1 shadow-lg ring-1 ring-zinc-950/10 backdrop-blur-xl dark:bg-zinc-800/85 dark:ring-white/10"
      style={{ left: position.x, top: position.y }}
      role="menu"
    >
      {items.map((item) => {
        if (item.separator) {
          return <div key={item.id} className="my-1 h-px bg-zinc-950/5 dark:bg-white/10" />
        }

        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.onSelect?.()
              onClose()
            }}
            className={clsx(
              'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
              item.disabled
                ? 'cursor-not-allowed text-muted-foreground'
                : item.danger
                  ? 'text-rose-500 hover:bg-rose-500/10'
                  : 'text-foreground hover:bg-muted',
            )}
          >
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
            {item.shortcut ? (
              <span className="text-xs text-muted-foreground">{item.shortcut}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
