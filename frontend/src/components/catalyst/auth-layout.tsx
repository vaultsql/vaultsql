import clsx from 'clsx'
import type React from 'react'

export function AuthLayout({
  children,
  panelClassName,
}: {
  children: React.ReactNode
  panelClassName?: string
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800">
      <div className="flex grow items-center justify-center p-6">
        <div
          className={clsx(
            'w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10 sm:p-10',
            panelClassName ?? 'max-w-md',
          )}
        >
          {children}
        </div>
      </div>
    </main>
  )
}
