import clsx from 'clsx'

export function ButtonGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="group"
      className={clsx(
        'inline-flex items-center gap-0.5',
        'rounded-md bg-zinc-100/50 dark:bg-zinc-800/50',
        'p-0.5',
        className,
      )}
    >
      {children}
    </div>
  )
}
