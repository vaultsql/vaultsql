import * as Headless from '@headlessui/react'
import { clsx } from 'clsx'
import { Check, ChevronDown, Code, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FilterChip } from './FilterChip'
import { FilterEditor } from './FilterEditor'
import { useFilterToolbar } from './useFilterToolbar'

export function FilterToolbar() {
  const {
    filters,
    columns,
    rawSqlWhere,
    filterMode,
    onUpdateFilter,
    onRemoveFilter,
    onAddFilter,
    onClear,
    onApplyRawSql,
    onRemoveRawSql,
    onSetFilterMode,
  } = useFilterToolbar()
  const [addOpen, setAddOpen] = useState(false)
  const [rawSqlOpen, setRawSqlOpen] = useState(false)
  const [rawSql, setRawSql] = useState('')
  const [editRawSqlOpen, setEditRawSqlOpen] = useState(false)
  const [editRawSql, setEditRawSql] = useState('')

  const handleAddFilter = (filter: Filter) => {
    onAddFilter(filter)
    setAddOpen(false)
  }

  const handleApplyRawSql = () => {
    if (rawSql.trim()) {
      onApplyRawSql(rawSql.trim())
      setRawSqlOpen(false)
      setRawSql('')
    }
  }

  const handleEditRawSql = () => {
    setEditRawSql(rawSqlWhere || '')
    setEditRawSqlOpen(true)
  }

  const handleSaveEditRawSql = () => {
    if (editRawSql.trim()) {
      onApplyRawSql(editRawSql.trim())
    } else {
      onRemoveRawSql()
    }
    setEditRawSqlOpen(false)
    setEditRawSql('')
  }

  if (columns.length === 0) {
    return null
  }

  const hasFilters = filters.length > 0 || rawSqlWhere !== null

  return (
    <div className="wb-filter-toolbar">
      {/* Label */}
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Where
      </span>

      {/* Filter chips */}
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {filters.map((filter) => (
          <FilterChip
            key={filter.id}
            filter={filter}
            columns={columns}
            onUpdate={onUpdateFilter}
            onRemove={() => onRemoveFilter(filter.id)}
          />
        ))}

        {/* Raw SQL chip */}
        {rawSqlWhere && (
          <Popover open={editRawSqlOpen} onOpenChange={setEditRawSqlOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="wb-filter-chip max-w-64"
                title={rawSqlWhere}
                onClick={handleEditRawSql}
              >
                <Code className="h-3 w-3 shrink-0" />
                <span className="wb-filter-chip-text font-mono">{rawSqlWhere}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="wb-filter-chip-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveRawSql()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRemoveRawSql()
                    }
                  }}
                  title="Remove raw SQL"
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-3">
              <div className="space-y-3">
                <div>
                  <label htmlFor="edit-raw-sql" className="mb-1 block text-xs font-medium text-foreground">
                    Raw SQL WHERE clause
                  </label>
                  <textarea
                    id="edit-raw-sql"
                    value={editRawSql}
                    onChange={(e) => setEditRawSql(e.target.value)}
                    placeholder="e.g. status = 'active' AND created_at > '2024-01-01'"
                    className="wb-input h-20 w-full resize-none font-mono text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        handleSaveEditRawSql()
                      }
                    }}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRawSqlOpen(false)}
                    className="wb-btn wb-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditRawSql}
                    className="wb-btn wb-btn-primary"
                  >
                    Ok
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Add filter button */}
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <FilterEditor
              filter={null}
              columns={columns}
              onSave={handleAddFilter}
              onCancel={() => setAddOpen(false)}
            />
          </PopoverContent>
        </Popover>

        {/* Raw SQL button */}
        <Popover open={rawSqlOpen} onOpenChange={setRawSqlOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground"
              title="Add raw SQL WHERE clause"
            >
              <Code className="h-3 w-3" />
              SQL
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3">
            <div className="space-y-3">
              <div>
                <label htmlFor="raw-sql" className="mb-1 block text-xs font-medium text-foreground">
                  Raw SQL WHERE clause
                </label>
                <textarea
                  id="raw-sql"
                  value={rawSql}
                  onChange={(e) => setRawSql(e.target.value)}
                  placeholder="e.g. status = 'active' AND created_at > '2024-01-01'"
                  className="wb-input h-20 w-full resize-none font-mono text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      handleApplyRawSql()
                    }
                  }}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to apply
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRawSqlOpen(false)}
                  className="wb-btn wb-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyRawSql}
                  className="wb-btn wb-btn-primary"
                  disabled={!rawSql.trim()}
                >
                  Ok
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Filter mode dropdown */}
      <div className="flex items-center gap-1">
        <Headless.Menu>
          <Headless.MenuButton
            className={clsx(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
              'text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-700',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            {filterMode === 'all' ? 'Match All' : 'Match Any'}
            <ChevronDown className="h-3 w-3" />
          </Headless.MenuButton>
          <Headless.MenuItems
            transition
            anchor="bottom end"
            className={clsx(
              // Anchor positioning
              '[--anchor-gap:4px] [--anchor-padding:4px]',
              // Base styles
              'z-50 min-w-[140px] rounded-md p-1',
              // Background
              'bg-white dark:bg-zinc-800',
              // Shadow and ring
              'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10',
              // Transitions
              'transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0',
              // Focus
              'outline outline-transparent focus:outline-hidden',
            )}
          >
            <Headless.MenuItem>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => onSetFilterMode('all')}
                  className={clsx(
                    'group flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs',
                    focus
                      ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300',
                  )}
                >
                  <span className="w-4 shrink-0">
                    {filterMode === 'all' && <Check className="h-3 w-3" />}
                  </span>
                  Match All
                </button>
              )}
            </Headless.MenuItem>
            <Headless.MenuItem>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => onSetFilterMode('any')}
                  className={clsx(
                    'group flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs',
                    focus
                      ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300',
                  )}
                >
                  <span className="w-4 shrink-0">
                    {filterMode === 'any' && <Check className="h-3 w-3" />}
                  </span>
                  Match Any
                </button>
              )}
            </Headless.MenuItem>
            {hasFilters && (
              <>
                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                <Headless.MenuItem>
                  {({ focus }) => (
                    <button
                      type="button"
                      onClick={onClear}
                      className={clsx(
                        'group flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs',
                        focus
                          ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-700 dark:text-zinc-300',
                      )}
                    >
                      <span className="w-4 shrink-0">
                        <X className="h-3 w-3" />
                      </span>
                      Clear
                    </button>
                  )}
                </Headless.MenuItem>
              </>
            )}
          </Headless.MenuItems>
        </Headless.Menu>
      </div>
    </div>
  )
}
