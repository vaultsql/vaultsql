import clsx from 'clsx'

export interface Step {
  number: number
  title: string
  status: 'completed' | 'current' | 'upcoming'
}

interface StepIndicatorProps {
  steps: Step[]
}

export function StepIndicator({ steps }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="space-y-4 md:flex md:space-y-0 md:space-x-8">
        {steps.map((step) => (
          <li key={step.number} className="md:flex-1">
            {step.status === 'completed' ? (
              <div className="group flex flex-col border-l-4 border-emerald-600 py-2 pl-4 md:border-t-4 md:border-l-0 md:pt-4 md:pb-0 md:pl-0 dark:border-emerald-500">
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Step {step.number}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {step.title}
                </span>
              </div>
            ) : step.status === 'current' ? (
              <div
                aria-current="step"
                className="flex flex-col border-l-4 border-blue-600 py-2 pl-4 md:border-t-4 md:border-l-0 md:pt-4 md:pb-0 md:pl-0 dark:border-blue-500"
              >
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Step {step.number}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {step.title}
                </span>
              </div>
            ) : (
              <div className="group flex flex-col border-l-4 border-zinc-200 py-2 pl-4 md:border-t-4 md:border-l-0 md:pt-4 md:pb-0 md:pl-0 dark:border-white/10">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Step {step.number}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {step.title}
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
