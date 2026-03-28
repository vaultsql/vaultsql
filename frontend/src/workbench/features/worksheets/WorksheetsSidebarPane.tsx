import { PlusIcon } from '@heroicons/react/24/outline'
import { ChevronDown } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  ToolbarDropdown,
  ToolbarDropdownButton,
  ToolbarDropdownItem,
  ToolbarDropdownMenu,
} from '@/components/workbench'
import { useFolders, useWorksheets } from '@/queries/worksheets'
import { ChevronRightIcon } from '../../components/SidebarTree'
import { useWorkbench } from '../../context/useWorkbench'
import { openWorksheetTab } from '../../tabs/controllers/openWorksheetTab'
import { FolderItem } from './FolderItem'
import { WorksheetItem } from './WorksheetItem'
import { CreateFolderDialog, CreateWorksheetDialog } from './WorksheetModals'

type WorksheetsSidebarPaneProps = {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function WorksheetsSidebarPane({
  isCollapsed = false,
  onToggleCollapse,
}: WorksheetsSidebarPaneProps) {
  const { serverId } = useWorkbench()
  const { data: folders = [], isLoading: foldersLoading } = useFolders(serverId)
  const { data: worksheets = [], isLoading: worksheetsLoading } = useWorksheets(serverId)

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [isCreateWorksheetOpen, setIsCreateWorksheetOpen] = useState(false)

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  const handleStartCreateFolder = useCallback(() => {
    if (isCollapsed) {
      onToggleCollapse?.()
    }
    setIsCreateWorksheetOpen(false)
    setIsCreateFolderOpen(true)
  }, [isCollapsed, onToggleCollapse])

  const handleStartCreateWorksheet = useCallback(() => {
    if (isCollapsed) {
      onToggleCollapse?.()
    }
    setIsCreateFolderOpen(false)
    setIsCreateWorksheetOpen(true)
  }, [isCollapsed, onToggleCollapse])

  const rootWorksheets = worksheets.filter((w) => !w.folder_id)

  const isLoading = foldersLoading || worksheetsLoading

  return (
    <div className="flex flex-col border-b border-border">
      {/* Header */}
      <div className="wb-tree-heading mx-1.5 flex items-center gap-2">
        <button type="button" onClick={onToggleCollapse} className="wb-tree-group flex-1 pl-3">
          <span
            className={`flex-shrink-0 text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
          >
            <ChevronRightIcon className="h-3 w-3" />
          </span>
          <span>Worksheets</span>
        </button>
        <div className="pr-1">
          <ToolbarDropdown>
            <ToolbarDropdownButton
              disabled={isCreateFolderOpen || isCreateWorksheetOpen}
              className="inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-600 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 active:bg-zinc-300/70 dark:active:bg-zinc-600/70 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>New</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </ToolbarDropdownButton>
            <ToolbarDropdownMenu>
              <ToolbarDropdownItem onClick={handleStartCreateWorksheet}>
                New worksheet
              </ToolbarDropdownItem>
              <ToolbarDropdownItem onClick={handleStartCreateFolder}>
                New folder
              </ToolbarDropdownItem>
            </ToolbarDropdownMenu>
          </ToolbarDropdown>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="max-h-64 overflow-y-auto px-2.5 pb-2.5 pt-1">
          {isLoading ? (
            <p className="px-2.5 py-1 text-[11px] text-muted-foreground">Loading...</p>
          ) : (
            <ul className="ml-1 pl-1.5">
              {/* Folders */}
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  worksheets={worksheets.filter((w) => w.folder_id === folder.id)}
                  isExpanded={expandedFolders.has(folder.id)}
                  onToggle={() => toggleFolder(folder.id)}
                />
              ))}

              {/* Root-level worksheets */}
              {rootWorksheets.map((worksheet) => (
                <WorksheetItem key={worksheet.id} worksheet={worksheet} />
              ))}

              {/* Empty state */}
              {folders.length === 0 && rootWorksheets.length === 0 && (
                <li className="px-1.5 py-0.5 text-[11px] text-muted-foreground">No worksheets</li>
              )}
            </ul>
          )}
        </div>
      )}
      <CreateWorksheetDialog
        open={isCreateWorksheetOpen}
        onOpenChange={setIsCreateWorksheetOpen}
        serverId={serverId}
        onCreated={(worksheet) =>
          openWorksheetTab({ worksheetId: worksheet.id, worksheetName: worksheet.name })
        }
      />
      <CreateFolderDialog
        open={isCreateFolderOpen}
        onOpenChange={setIsCreateFolderOpen}
        serverId={serverId}
      />
    </div>
  )
}
