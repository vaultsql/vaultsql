export function getEnvironmentBorder(environment?: string | null) {
  if (!environment) return ''
  switch (environment.toLowerCase()) {
    case 'production':
      return 'border-l-4 border-l-red-500'
    case 'staging':
      return 'border-l-4 border-l-blue-400'
    default:
      return ''
  }
}

export function formatAccessExpiry(grantedUntil?: string | null) {
  if (!grantedUntil) return ''
  return new Date(grantedUntil).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
