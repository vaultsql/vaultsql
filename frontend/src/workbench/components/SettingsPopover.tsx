import clsx from 'clsx'
import { EyeIcon, PencilIcon, ShieldCheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Checkbox, CheckboxField } from '@/components/catalyst/checkbox'
import { Label } from '@/components/catalyst/fieldset'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { WorkbenchPermissions } from '../context/permissions'
import { useWorkbenchSettingsStore } from '../context/useWorkbenchSettingsStore'

type SettingsPopoverProps = {
  permissions: WorkbenchPermissions
}

function getAccessLevelIcon(accessLevel: WorkbenchPermissions['accessLevel']) {
  switch (accessLevel) {
    case 'admin':
      return <ShieldCheckIcon className="h-3 w-3" />
    case 'write':
      return <PencilIcon className="h-3 w-3" />
    case 'readonly':
      return <EyeIcon className="h-3 w-3" />
  }
}

function getAccessLevelLabel(accessLevel: WorkbenchPermissions['accessLevel']) {
  switch (accessLevel) {
    case 'admin':
      return 'Admin'
    case 'write':
      return 'Write'
    case 'readonly':
      return 'Read-only'
  }
}

function getAccessLevelColor(accessLevel: WorkbenchPermissions['accessLevel']) {
  switch (accessLevel) {
    case 'admin':
      return 'text-purple-600 dark:text-purple-400'
    case 'write':
      return 'text-blue-600 dark:text-blue-400'
    case 'readonly':
      return 'text-zinc-600 dark:text-zinc-400'
  }
}

export function SettingsPopover({ permissions }: SettingsPopoverProps) {
  const allowEditOperations = useWorkbenchSettingsStore((s) => s.allowEditOperations)
  const allowTableModify = useWorkbenchSettingsStore((s) => s.allowTableModify)
  const setAllowEditOperations = useWorkbenchSettingsStore((s) => s.setAllowEditOperations)
  const setAllowTableModify = useWorkbenchSettingsStore((s) => s.setAllowTableModify)

  const isReadonly = permissions.accessLevel === 'readonly'
  const canEditData = permissions.canWrite
  const canModifyTables = permissions.canAlterTables

  // When user doesn't have permission, show checkbox as unchecked (reflecting actual capability)
  const effectiveAllowEdit = canEditData && allowEditOperations
  const effectiveAllowModify = canModifyTables && allowTableModify

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer',
            'border border-zinc-200 dark:border-zinc-700',
            'bg-zinc-50 dark:bg-zinc-800/50',
            'hover:bg-zinc-100 dark:hover:bg-zinc-700/50',
            'transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-zinc-400',
            getAccessLevelColor(permissions.accessLevel),
          )}
          title={`Access Level: ${getAccessLevelLabel(permissions.accessLevel)}`}
        >
          {getAccessLevelIcon(permissions.accessLevel)}
          <span className="font-medium">{getAccessLevelLabel(permissions.accessLevel)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Session Settings</h4>
          <div className="space-y-3">
            <CheckboxField>
              <Checkbox
                checked={effectiveAllowEdit}
                onChange={setAllowEditOperations}
                color="blue"
                disabled={!canEditData}
              />
              <Label className={!canEditData ? 'opacity-50' : ''}>
                Allow edit operations
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  Enable INSERT, UPDATE, DELETE in data grid
                </span>
              </Label>
            </CheckboxField>
            <CheckboxField>
              <Checkbox
                checked={effectiveAllowModify}
                onChange={setAllowTableModify}
                color="blue"
                disabled={!canModifyTables}
              />
              <Label className={!canModifyTables ? 'opacity-50' : ''}>
                Allow table modify operations
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  Enable DROP TABLE, TRUNCATE, ALTER TABLE
                </span>
              </Label>
            </CheckboxField>
          </div>
          <p className="text-xs text-muted-foreground">
            {isReadonly
              ? 'Read-only access. Settings are disabled.'
              : 'These settings are session-only and will reset on page refresh.'}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
