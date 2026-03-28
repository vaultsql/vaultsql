import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import { ChevronDown, Eye, Save, X } from 'lucide-react'
import { ToolbarDropdownItem, ToolbarDropdownMenu } from '@/components/workbench'
import type { CommitResult } from '@/workbench/lib/mutations'

type SaveButtonProps = {
  onSave: () => Promise<CommitResult>
  onPreview: () => void
  onDiscard: () => void
  disabled: boolean
  count: number
}

const baseStyles = [
  'inline-flex items-center justify-center gap-1',
  'px-2 py-1',
  'text-xs font-medium',
  'transition-colors',
  'focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400',
]

const enabledStyles = ['bg-indigo-600 text-white', 'hover:bg-indigo-700', 'active:bg-indigo-800']

const disabledStyles = [
  'border border-zinc-300 dark:border-zinc-600',
  'text-zinc-400 dark:text-zinc-500',
  'bg-transparent',
  'cursor-not-allowed',
]

export function SaveButton({ onSave, onPreview, onDiscard, disabled, count }: SaveButtonProps) {
  return (
    <div className="inline-flex">
      {/* Main save button */}
      <button
        type="button"
        disabled={disabled}
        title={disabled ? 'No pending changes' : `Save ${count} change${count !== 1 ? 's' : ''}`}
        onClick={() => void onSave()}
        className={clsx(
          baseStyles,
          'rounded-l',
          disabled ? disabledStyles : enabledStyles,
          disabled && 'border-r-0',
          !disabled && 'border border-r-0 border-indigo-700',
        )}
      >
        <Save className="h-3.5 w-3.5" />
        <span>Save</span>
        {!disabled && count > 0 && (
          <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
            {count}
          </span>
        )}
      </button>

      {/* Dropdown arrow */}
      <Headless.Menu>
        <Headless.MenuButton
          disabled={disabled}
          className={clsx(
            'inline-flex items-center justify-center',
            'px-1 py-1',
            'rounded-r',
            'transition-colors',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400',
            disabled ? disabledStyles : enabledStyles,
            disabled && 'border-l border-zinc-300 dark:border-zinc-600',
            !disabled && 'border border-l-0 border-indigo-700',
          )}
        >
          <ChevronDown className="h-3 w-3" />
        </Headless.MenuButton>

        <ToolbarDropdownMenu>
          <ToolbarDropdownItem onClick={onPreview} disabled={disabled}>
            <Eye data-slot="icon" />
            Preview Changes
          </ToolbarDropdownItem>
          <ToolbarDropdownItem onClick={onDiscard} disabled={disabled}>
            <X data-slot="icon" />
            Discard Changes
          </ToolbarDropdownItem>
        </ToolbarDropdownMenu>
      </Headless.Menu>
    </div>
  )
}
