import clsx from 'clsx'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  DatabaseIcon,
  Eye,
  LayersIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  Table,
} from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownMenu,
} from '@/components/catalyst/dropdown'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useAppContext } from '@/lib/app-context'
import { useUser } from '@/queries/user'
import { EnvironmentBadge } from '../components/EnvironmentBadge'
import { SettingsPopover } from '../components/SettingsPopover'
import { useWorkbench } from '../context/useWorkbench'
import { useSchemaLoader } from '../features/schema-browser/useSchemaLoader'
import { useSchemasStore } from '../features/schema-browser/useSchemasStore'
import { openDraftSqlTab } from '../tabs/controllers/openDraftSqlTab'
import { openTableTab } from '../tabs/controllers/openTableTab'
import { useCommandPalette } from './useCommandPalette'

export function Toolbar() {
  const navigate = useNavigate()
  const { accountName, databaseName, permissions } = useWorkbench()
  const { data: user } = useUser()
  const { clearVault } = useAppContext()
  const schemaNames = useSchemasStore((state) => state.schemaNames)
  const activeSchema = useSchemasStore((state) => state.activeSchema)
  const assets = useSchemasStore((state) => state.assets)
  const setActiveSchema = useSchemasStore((state) => state.setActiveSchema)
  const { loadSchema } = useSchemaLoader()
  const { open, mode, setOpen, setMode } = useCommandPalette()

  // Sort tables and views together alphabetically
  const tablesAndViews = [...assets].sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, setOpen])

  useEffect(() => {
    if (!open) {
      setMode('tables')
    }
  }, [open, setMode])

  const handleSchemaSelect = (schema: string) => {
    setActiveSchema(schema)
    void loadSchema(schema)
    setOpen(false)
  }

  const handleTableSelect = (name: string, isView: boolean) => {
    if (activeSchema) {
      openTableTab({ schema: activeSchema, table: name, isView })
    }
    setOpen(false)
  }

  const handleLogout = async () => {
    await clearVault()
    navigate('/login')
  }

  const getPlaceholder = () => {
    switch (mode) {
      case 'schema':
        return 'Switch schema...'
      case 'tables':
        return 'Jump to table or view...'
    }
  }

  return (
    <>
      <header
        className={clsx(
          'flex items-center',
          'px-4 py-2',
          'bg-white/80 dark:bg-zinc-900/80 backdrop-blur',
          'border-b border-zinc-950/10 dark:border-white/10',
          'relative z-10',
        )}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
              'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600',
              'text-zinc-900 dark:text-zinc-100',
              'transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-zinc-400',
            )}
            aria-label="Exit"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Exit
          </button>

          <button
            onClick={() => openDraftSqlTab()}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
              'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700',
              'text-white',
              'transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-400',
            )}
            aria-label="New SQL"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            SQL
          </button>

          <h1 className="text-sm font-semibold text-zinc-950 dark:text-white">VaultSQL</h1>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded',
              'font-mono text-xs',
              'bg-zinc-100 dark:bg-zinc-800',
              'border border-zinc-200 dark:border-zinc-700',
              'hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80',
              'transition-colors',
              'focus:outline-none focus:ring-1 focus:ring-[var(--wb-accent)]',
            )}
          >
            <span className="text-foreground">{databaseName}</span>
            <span className="text-muted-foreground">({accountName})</span>
            {activeSchema && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{activeSchema}</span>
              </>
            )}
            <ChevronDownIcon className="h-3 w-3 text-muted-foreground ml-1" />
            <kbd className="ml-1.5 pointer-events-none hidden h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] opacity-100 sm:flex">
              ⌘K
            </kbd>
          </button>

          <EnvironmentBadge environment={permissions.environment} />

          <SettingsPopover permissions={permissions} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user && (
            <Dropdown>
              <DropdownButton plain className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-700 dark:text-zinc-300">{user.user.email}</span>
                <ChevronDownIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              </DropdownButton>
              <DropdownMenu>
                <DropdownItem onClick={() => navigate('/settings')}>
                  <SettingsIcon data-slot="icon" />
                  Settings
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem onClick={handleLogout}>
                  <LogOutIcon data-slot="icon" />
                  Logout
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      </header>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Jump to"
        description="Search tables and views"
      >
        <CommandInput placeholder={getPlaceholder()} className="font-mono text-xs" />
        <CommandList className="font-mono text-xs">
          <CommandEmpty>No results found.</CommandEmpty>

          {mode === 'tables' && (
            <>
              <CommandGroup heading={`Tables & Views in ${activeSchema ?? 'schema'}`}>
                {tablesAndViews.length === 0 ? (
                  <CommandItem disabled className="text-xs text-muted-foreground">
                    No tables or views in this schema
                  </CommandItem>
                ) : (
                  tablesAndViews.map((asset) => {
                    const isView = asset.type === 'view'
                    return (
                      <CommandItem
                        key={asset.name}
                        value={asset.name}
                        onSelect={() => handleTableSelect(asset.name, isView)}
                        className="text-xs"
                      >
                        {isView ? (
                          <Eye className="mr-2 h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Table className="mr-2 h-3.5 w-3.5 text-blue-500" />
                        )}
                        {asset.name}
                        {isView && (
                          <span className="ml-auto text-xs text-muted-foreground">view</span>
                        )}
                      </CommandItem>
                    )
                  })
                )}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem
                  value="switch-schema"
                  onSelect={() => setMode('schema')}
                  className="text-xs"
                >
                  <LayersIcon className="mr-2 h-3.5 w-3.5" />
                  Switch Schema
                  {activeSchema && (
                    <span className="ml-auto text-muted-foreground">{activeSchema}</span>
                  )}
                </CommandItem>
              </CommandGroup>
            </>
          )}

          {mode === 'schema' && (
            <CommandGroup heading="Schemas">
              {schemaNames.map((schema) => (
                <CommandItem
                  key={schema}
                  value={schema}
                  onSelect={() => handleSchemaSelect(schema)}
                  className="text-xs"
                >
                  <DatabaseIcon className="mr-2 h-3.5 w-3.5" />
                  {schema}
                  {activeSchema === schema && (
                    <span className="ml-auto text-muted-foreground">current</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
