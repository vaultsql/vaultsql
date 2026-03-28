import clsx from 'clsx'

export function ToolbarSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={clsx('mx-1.5 h-4 w-px', 'bg-zinc-300 dark:bg-zinc-600', className)}
    />
  )
}
