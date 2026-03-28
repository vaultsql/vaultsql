interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div>{message}</div>
    </div>
  )
}
