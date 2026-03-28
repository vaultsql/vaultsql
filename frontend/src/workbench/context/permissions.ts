export type AccessLevel = 'readonly' | 'write' | 'admin'
export type DatabaseEnvironment = 'production' | 'staging' | 'testing' | 'development' | null

export type WorkbenchPermissions = {
  accessLevel: AccessLevel
  environment: DatabaseEnvironment
  // Derived capability flags
  canRead: boolean // Always true
  canWrite: boolean // write or admin
  canCreateTables: boolean // admin only
  canDropTables: boolean // admin only
  canAlterTables: boolean // admin only
}

/**
 * Derives permission flags from an access level.
 * This function encapsulates the business logic for what each access level can do.
 */
export function derivePermissions(
  accessLevel: AccessLevel,
  environment: DatabaseEnvironment,
): WorkbenchPermissions {
  const isWrite = accessLevel === 'write' || accessLevel === 'admin'
  const isAdmin = accessLevel === 'admin'

  return {
    accessLevel,
    environment,
    canRead: true, // All access levels can read
    canWrite: isWrite,
    canCreateTables: isAdmin,
    canDropTables: isAdmin,
    canAlterTables: isAdmin,
  }
}
