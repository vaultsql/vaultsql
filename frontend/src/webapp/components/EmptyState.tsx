import type React from 'react'
import { Button } from '@/components/catalyst/button'
import { Text } from '@/components/catalyst/text'

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title?: string
  message: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, message, action, className }: EmptyStateProps) {
  return (
    <div className={`flex h-full items-center justify-center ${className || ''}`}>
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-md">
        {Icon && (
          <div className="mb-4 rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
            <Icon className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          </div>
        )}
        {title && (
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
        )}
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">{message}</Text>
        {action && (
          <div className="mt-6">
            {action.href ? (
              <Button href={action.href} outline>
                {action.label}
              </Button>
            ) : (
              <Button onClick={action.onClick} outline>
                {action.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
