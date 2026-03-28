import {
  Clipboard,
  ClipboardCopy,
  Play,
  Plus,
  Scissors,
  SquareArrowOutUpRight,
  Star,
  Trash2,
} from 'lucide-react'
import { useCallback } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  MaterializedViewResourceIcon,
  RoutineResourceIcon,
  TableResourceIcon,
  ViewResourceIcon,
} from '../../components/ResourceIcons'
import { SidebarTree, SidebarTreeGroup, SidebarTreeItem } from '../../components/SidebarTree'
import { useWorkbench } from '../../context/useWorkbench'
import { openDraftSqlTab } from '../../tabs/controllers/openDraftSqlTab'
import { openNewTableTab } from '../../tabs/controllers/openNewTableTab'
import { openRoutineTab } from '../../tabs/controllers/openRoutineTab'
import { openTableTab } from '../../tabs/controllers/openTableTab'
import { useSchemasStore } from './useSchemasStore'

export function ResourcePane() {
  const activeSchema = useSchemasStore((state) => state.activeSchema)
  const assets = useSchemasStore((state) => state.assets)
  const schemaObjects = useSchemasStore((state) => state.schemaObjects)
  const status = useSchemasStore((state) => state.status)
  const assetsStatus = useSchemasStore((state) => state.assetsStatus)
  const objectsStatus = useSchemasStore((state) => state.objectsStatus)
  const { starredStore } = useWorkbench()

  // Starred store actions
  const addTableStar = starredStore((state) => state.addTableStar)
  const removeStar = starredStore((state) => state.removeStar)
  const hasTableStar = starredStore((state) => state.hasTableStar)
  const getTableStarId = starredStore((state) => state.getTableStarId)

  // Combine tables, views, and materialized views into a single sorted list
  const materializedViews = schemaObjects.filter((obj) => obj.type === 'materialized_view')
  const tablesAndViews = [...assets, ...materializedViews].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  // Filter to only functions and procedures for routines section
  const routines = schemaObjects
    .filter((obj) => obj.type === 'function' || obj.type === 'procedure')
    .sort((a, b) => a.name.localeCompare(b.name))

  const handleCopyName = useCallback((name: string) => {
    navigator.clipboard.writeText(name)
  }, [])

  const handleCopyQualifiedName = useCallback(
    (name: string) => {
      if (activeSchema) {
        navigator.clipboard.writeText(`${activeSchema}.${name}`)
      }
    },
    [activeSchema],
  )

  const handleQueryTable = useCallback(
    (name: string) => {
      if (activeSchema) {
        const query = `SELECT * FROM ${activeSchema}.${name} LIMIT 100;`
        openDraftSqlTab({ initialContent: query })
      }
    },
    [activeSchema],
  )

  const handleToggleStar = useCallback(
    (name: string) => {
      if (!activeSchema) return
      const isStarred = hasTableStar(activeSchema, name)
      if (isStarred) {
        const starId = getTableStarId(activeSchema, name)
        if (starId) removeStar(starId)
      } else {
        addTableStar(activeSchema, name)
      }
    },
    [activeSchema, hasTableStar, getTableStarId, removeStar, addTableStar],
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto">
      {/* Tables list */}
      <SidebarTree>
        <SidebarTreeGroup label="Tables" defaultOpen={true} className="px-2 wb-tree-heading">
          {assetsStatus === 'loading' || assetsStatus === 'idle' ? (
            <li className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {status === 'success' ? 'Loading...' : ''}
            </li>
          ) : assetsStatus === 'error' ? (
            <li className="px-1.5 py-0.5 text-[11px] text-red-500">Error loading assets</li>
          ) : tablesAndViews.length === 0 ? (
            <li className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
              No tables or views in this schema
            </li>
          ) : (
            tablesAndViews.map((asset) => {
              const isView = asset.type === 'view'
              const isMaterializedView = asset.type === 'materialized_view'
              const isTable = asset.type === 'table'
              const isStarred = activeSchema ? hasTableStar(activeSchema, asset.name) : false

              let icon = <TableResourceIcon />
              if (isView) {
                icon = <ViewResourceIcon />
              } else if (isMaterializedView) {
                icon = <MaterializedViewResourceIcon />
              }

              return (
                <li key={asset.name}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeSchema) {
                            openTableTab({
                              schema: activeSchema,
                              table: asset.name,
                              isView: isView || isMaterializedView,
                              preview: true,
                            })
                          }
                        }}
                        onDoubleClick={() => {
                          if (activeSchema) {
                            openTableTab({
                              schema: activeSchema,
                              table: asset.name,
                              isView: isView || isMaterializedView,
                              preview: false,
                            })
                          }
                        }}
                        className="wb-tree-row wb-tree-row-inactive transition-colors"
                      >
                        <span className="wb-tree-icon">{icon}</span>
                        <span className="truncate flex-1 text-left font-mono">{asset.name}</span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onSelect={() => {
                          if (activeSchema) {
                            openTableTab({
                              schema: activeSchema,
                              table: asset.name,
                              isView: isView || isMaterializedView,
                              preview: false,
                            })
                          }
                        }}
                      >
                        <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                        Open
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => handleToggleStar(asset.name)}>
                        <Star
                          className={`mr-2 h-4 w-4 ${isStarred ? 'fill-current text-yellow-500' : ''}`}
                        />
                        {isStarred ? 'Unstar' : 'Star'}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => handleCopyName(asset.name)}>
                        <Clipboard className="mr-2 h-4 w-4" />
                        Copy Name
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => handleCopyQualifiedName(asset.name)}>
                        <ClipboardCopy className="mr-2 h-4 w-4" />
                        Copy Qualified Name
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => handleQueryTable(asset.name)}>
                        <Play className="mr-2 h-4 w-4" />
                        Query Table
                      </ContextMenuItem>
                      {isTable && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuItem disabled>
                            <Scissors className="mr-2 h-4 w-4" />
                            Truncate Table
                          </ContextMenuItem>
                          <ContextMenuItem disabled className="text-red-600 focus:text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Drop Table
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </li>
              )
            })
          )}
        </SidebarTreeGroup>

        {/* Routines section */}
        <SidebarTreeGroup label="Routines" defaultOpen={false} className="px-2 wb-tree-heading">
          {objectsStatus === 'loading' || objectsStatus === 'idle' ? (
            <li className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {status === 'success' ? 'Loading routines...' : ''}
            </li>
          ) : objectsStatus === 'error' ? (
            <li className="px-1.5 py-0.5 text-[11px] text-red-500">Error loading routines</li>
          ) : routines.length === 0 ? (
            <li className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
              No routines in this schema
            </li>
          ) : (
            routines.map((routine) => (
              <SidebarTreeItem
                key={`${routine.type}:${routine.name}`}
                label={routine.name}
                icon={<RoutineResourceIcon objectType={routine.type} />}
                onClick={() => {
                  if (activeSchema) {
                    openRoutineTab({
                      schema: activeSchema,
                      objectName: routine.name,
                      objectType: routine.type as 'function' | 'procedure',
                      preview: true,
                    })
                  }
                }}
                onDoubleClick={() => {
                  if (activeSchema) {
                    openRoutineTab({
                      schema: activeSchema,
                      objectName: routine.name,
                      objectType: routine.type as 'function' | 'procedure',
                      preview: false,
                    })
                  }
                }}
              />
            ))
          )}
        </SidebarTreeGroup>
      </SidebarTree>

      {/* New Table button */}
      <div className="px-3 py-2 border-t border-border/50">
        <button
          type="button"
          onClick={() => {
            if (activeSchema) {
              openNewTableTab({ schema: activeSchema })
            }
          }}
          disabled={!activeSchema}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          New Table
        </button>
      </div>
    </section>
  )
}
