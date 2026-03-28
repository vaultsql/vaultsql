import { useEffect, useState } from 'react'
import { hideHelpScoutBeacon, showHelpScoutBeacon } from '@/components/HelpScoutBeacon'
import { SimpleSplit } from './components/SimpleSplit'
import { ResourcePane } from './features/schema-browser/ResourcePane'
import { useSchemaLoader } from './features/schema-browser/useSchemaLoader'
import { useSchemasStore } from './features/schema-browser/useSchemasStore'
import { StarredPane } from './features/starred'
import { WorksheetsSidebarPane } from './features/worksheets/WorksheetsSidebarPane'
import { useWorkbenchShortcuts } from './hooks/useKeyboardShortcuts'
import { ResultPane, StatusBar, Toolbar } from './layout'

export function Workbench() {
  useWorkbenchShortcuts()

  // Hide HelpScout beacon when workbench is open, restore when closed
  useEffect(() => {
    hideHelpScoutBeacon()
    return () => {
      showHelpScoutBeacon()
    }
  }, [])
  const { initializeSchemas, loadSchema } = useSchemaLoader()
  const schemasStatus = useSchemasStore((state) => state.status)
  const activeSchema = useSchemasStore((state) => state.activeSchema)
  const assetsStatus = useSchemasStore((state) => state.assetsStatus)

  const [worksheetsPaneCollapsed, setWorksheetsPaneCollapsed] = useState(false)

  useEffect(() => {
    if (schemasStatus === 'idle') {
      void initializeSchemas()
    }
  }, [schemasStatus, initializeSchemas])

  // Load schema assets when active schema changes and assets are not loaded
  useEffect(() => {
    if (activeSchema && schemasStatus === 'success' && assetsStatus === 'idle') {
      void loadSchema(activeSchema)
    }
  }, [activeSchema, schemasStatus, assetsStatus, loadSchema])

  return (
    <div className="wb-shell flex h-full w-full flex-col overflow-hidden">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <SimpleSplit className="flex-1" initialSizes={[20, 80]}>
          <div className="wb-sidebar flex h-full flex-col overflow-hidden border-r border-border bg-card">
            <WorksheetsSidebarPane
              isCollapsed={worksheetsPaneCollapsed}
              onToggleCollapse={() => setWorksheetsPaneCollapsed((prev) => !prev)}
            />
            <StarredPane />
            <ResourcePane />
          </div>
          <ResultPane />
        </SimpleSplit>
      </div>
      <StatusBar />
    </div>
  )
}
