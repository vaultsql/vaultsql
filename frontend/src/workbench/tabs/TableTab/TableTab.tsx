import { Table } from 'lucide-react'
import { useState } from 'react'
import type { TabDescriptor } from '../useTabsStore'
import { FilterToolbar } from './components/filters'
import { PaginationBar } from './components/PaginationBar'
import { StructurePane } from './components/panes/StructurePane'
import { TableDataPane } from './components/panes/TableDataPane'
import { TableToolbar } from './components/toolbars/TableToolbar'
import { TableTabProvider, useTableTabContext } from './state/TableTabContext'

type TableTabProps = {
  tab: TabDescriptor
}

type PaneType = 'data' | 'structure'

export function TableTab({ tab }: TableTabProps) {
  return (
    <TableTabProvider key={tab.id} tab={tab}>
      <TableTabContent />
    </TableTabProvider>
  )
}

function TableTabContent() {
  const { tab, schema, table, columns } = useTableTabContext()
  const [activePane, setActivePane] = useState<PaneType>('data')

  return (
    <>
      <div className="flex h-full flex-col">
        <TableToolbar />

        {/* Filter toolbar - only show for data pane */}
        {activePane === 'data' && columns.length > 0 && <FilterToolbar />}

        <div className="min-h-0 flex-1 overflow-hidden">
          {activePane === 'data' && <TableDataPane />}
          {activePane === 'structure' &&
            (schema && table ? (
              <StructurePane schema={schema} table={table} />
            ) : (
              <StructurePlaceholder tableName={tab.title} />
            ))}
        </div>

        {/* Consolidated bottom toolbar with pane switcher and pagination */}
        <div className="flex h-9 items-center border-t border-border bg-muted/30 px-3">
          {/* Pane switcher */}
          <div className="flex items-center">
            <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background/40 p-0.5 shadow-sm shadow-black/5">
              <button
                type="button"
                aria-pressed={activePane === 'data'}
                onClick={() => setActivePane('data')}
                className={`relative rounded-sm px-2.5 py-0.5 font-mono text-xs transition-colors ${
                  activePane === 'data'
                    ? 'bg-background text-foreground shadow-sm after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-indigo-500'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                }`}
              >
                Data
              </button>
              <button
                type="button"
                aria-pressed={activePane === 'structure'}
                onClick={() => setActivePane('structure')}
                className={`relative rounded-sm px-2.5 py-0.5 font-mono text-xs transition-colors ${
                  activePane === 'structure'
                    ? 'bg-background text-foreground shadow-sm after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-indigo-500'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                }`}
              >
                Structure
              </button>
            </div>
          </div>

          {/* Pagination controls (only show for data pane) */}
          <div className="flex min-w-0 flex-1 items-center px-3">
            {activePane === 'data' ? <PaginationBar /> : null}
          </div>
        </div>
      </div>
    </>
  )
}

function StructurePlaceholder({ tableName }: { tableName: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Table className="h-10 w-10 opacity-50" />
      <p className="text-sm font-medium">Table Structure</p>
      <p className="text-xs">
        View and edit columns, indexes, and constraints for{' '}
        <span className="text-foreground">{tableName}</span>
      </p>
    </div>
  )
}
