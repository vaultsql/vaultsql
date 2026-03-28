import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Star } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { TableResourceIcon } from '../../components/ResourceIcons'
import { SidebarTree, SidebarTreeGroup } from '../../components/SidebarTree'
import { useWorkbench } from '../../context/useWorkbench'
import { openTableTab } from '../../tabs/controllers/openTableTab'
import { useSchemasStore } from '../schema-browser/useSchemasStore'
import type { StarredItem } from './useStarredStore'

export function StarredPane() {
  const { starredStore } = useWorkbench()
  const stars = starredStore((state) => state.stars)
  const removeStar = starredStore((state) => state.removeStar)
  const clearStars = starredStore((state) => state.clearStars)
  const assets = useSchemasStore((state) => state.assets)

  // Create a set of existing tables for quick lookup
  const existingTables = useMemo(() => {
    const tableSet = new Set<string>()
    for (const asset of assets) {
      tableSet.add(`${asset.schema}.${asset.name}`)
    }
    return tableSet
  }, [assets])

  const handleStarClick = useCallback((star: StarredItem) => {
    if (star.type === 'table') {
      // Open table without filters
      openTableTab({
        schema: star.schema,
        table: star.table,
      })
    } else {
      // Open table with row filter
      openTableTab({
        schema: star.schema,
        table: star.table,
        filters: [
          {
            column: star.primaryKeyColumn!,
            operator: 'eq',
            value: star.primaryKeyValue!,
          },
        ],
      })
    }
  }, [])

  const handleRemoveStar = useCallback(
    (e: React.MouseEvent, starId: string) => {
      e.stopPropagation()
      removeStar(starId)
    },
    [removeStar],
  )

  const handleClearAll = useCallback(() => {
    clearStars()
  }, [clearStars])

  // Don't render anything if there are no stars (after all hooks are called)
  if (stars.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col border-b border-border">
      {/* Header with Clear link */}
      <div className="wb-tree-heading mx-1.5 flex items-center gap-2">
        <button type="button" className="wb-tree-group flex-1 pl-3 cursor-default">
          <span className="flex-shrink-0 text-muted-foreground">
            <Star className="h-3 w-3" />
          </span>
          <span>Starred</span>
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          className="pr-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto px-2.5 pb-2.5 pt-1">
        <ul className="ml-1 pl-1.5">
          {stars.map((star) => {
            const tableKey = `${star.schema}.${star.table}`
            const tableExists = existingTables.has(tableKey)

            let displayLabel = ''
            if (star.type === 'row') {
              displayLabel = star.displayLabel || `${star.primaryKeyColumn}=${star.primaryKeyValue}`
            }

            return (
              <li key={star.id}>
                <button
                  type="button"
                  onClick={() => handleStarClick(star)}
                  className="wb-tree-row wb-tree-row-inactive group transition-colors"
                >
                  <span className="wb-tree-icon">
                    <TableResourceIcon />
                  </span>
                  <span className="truncate flex-1 text-left">
                    <span className="font-mono text-[11px]">{tableKey}</span>
                    {star.type === 'row' && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        ({displayLabel})
                      </span>
                    )}
                  </span>
                  {!tableExists && (
                    <span
                      className="text-yellow-600 dark:text-yellow-500 mr-1"
                      title="Table no longer exists"
                    >
                      <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveStar(e, star.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                    title="Remove star"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
