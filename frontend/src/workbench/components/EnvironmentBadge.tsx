import clsx from 'clsx'
import type { DatabaseEnvironment } from '../context/permissions'

type EnvironmentBadgeProps = {
  environment: DatabaseEnvironment
  className?: string
}

const environmentConfig = {
  production: {
    label: 'Production',
    className: 'bg-red-900/50 text-red-200 border-red-700',
  },
  staging: {
    label: 'Staging',
    className: 'bg-amber-900/50 text-amber-200 border-amber-700',
  },
  testing: {
    label: 'Testing',
    className: 'bg-blue-900/50 text-blue-200 border-blue-700',
  },
  development: {
    label: 'Development',
    className: 'bg-emerald-900/50 text-emerald-200 border-emerald-700',
  },
} as const

export function EnvironmentBadge({ environment, className }: EnvironmentBadgeProps) {
  if (!environment) {
    return null
  }

  const config = environmentConfig[environment]

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
