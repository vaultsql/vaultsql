import { useUser } from '@/queries/user'

/**
 * Hook to check vault access status.
 * Returns flags and helper functions for vault key management.
 *
 * Key state is derived from userData.key:
 * - key is null → needs_key_create
 * - key.approved_at is null → needs_key_approval
 * - key.approved_at is set → active key ready for use
 */
export function useVaultAccess() {
  const { data: userData, isLoading } = useUser()

  const key = userData?.key
  const needsKeyCreate = !key
  const needsKeyApproval = !!key && !key.approved_at
  const hasFullAccess = !!key && !!key.approved_at

  return {
    isLoading,
    needsKeyCreate,
    needsKeyApproval,
    isBlocked: needsKeyCreate || needsKeyApproval,
    hasFullAccess,
    key,
    flags: userData?.flags,
  }
}
