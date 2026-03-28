import { useWorkbench } from './useWorkbench'

/**
 * Convenience hook to access workbench permissions without needing the full context.
 * Use this when you only need to check permissions and don't need other context values.
 */
export function usePermissions() {
  const { permissions } = useWorkbench()
  return permissions
}
