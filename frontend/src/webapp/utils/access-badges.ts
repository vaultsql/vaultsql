export function getEnvironmentBadgeColor(
  environment?: string | null,
): 'red' | 'yellow' | 'blue' | 'green' {
  switch (environment) {
    case 'production':
      return 'red'
    case 'staging':
      return 'yellow'
    case 'testing':
      return 'blue'
    case 'development':
      return 'green'
    default:
      return 'blue'
  }
}

export function getEnvironmentLabel(environment?: string | null): string {
  if (!environment) return ''
  return environment.charAt(0).toUpperCase() + environment.slice(1)
}

export function getAccessLevelBadgeColor(accessLevel?: string): 'zinc' | 'blue' | 'red' {
  switch (accessLevel) {
    case 'readonly':
      return 'zinc'
    case 'write':
      return 'blue'
    case 'admin':
      return 'red'
    default:
      return 'zinc'
  }
}

export function getAccessLevelLabel(accessLevel?: string): string {
  switch (accessLevel) {
    case 'readonly':
      return 'Read-only'
    case 'write':
      return 'Write'
    case 'admin':
      return 'Admin'
    default:
      return 'Read-only'
  }
}
