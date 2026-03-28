import { FilePlus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Folder, Worksheet } from '@/queries/worksheets'
import { ChevronRightIcon } from '../../components/SidebarTree'
import { useWorkbench } from '../../context/useWorkbench'
import { openWorksheetTab } from '../../tabs/controllers/openWorksheetTab'
import { WorksheetItem } from './WorksheetItem'
import {
  CreateWorksheetDialog,
  DeleteFolderConfirmDialog,
  RenameFolderDialog,
} from './WorksheetModals'

export type FolderItemProps = {
  folder: Folder
  worksheets: Worksheet[]
  isExpanded: boolean
  onToggle: () => void
}

export function FolderItem({ folder, worksheets, isExpanded, onToggle }: FolderItemProps) {
  const { serverId } = useWorkbench()

  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isCreateWorksheetOpen, setIsCreateWorksheetOpen] = useState(false)

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={onToggle}
            className="wb-tree-row wb-tree-row-inactive wb-tree-row-folder"
          >
            <span className={`flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              <ChevronRightIcon className="h-3 w-3" />
            </span>
            <span className="truncate font-sans">{folder.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setIsCreateWorksheetOpen(true)}>
            <FilePlus className="mr-2 h-4 w-4" />
            New Worksheet
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setIsRenameOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => setIsDeleteOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && (
        <ul className="ml-2 pl-2 wb-tree-guide">
          {worksheets.map((worksheet) => (
            <WorksheetItem key={worksheet.id} worksheet={worksheet} />
          ))}
          {worksheets.length === 0 && (
            <li className="px-1.5 py-0.5 text-[11px] text-muted-foreground">Empty</li>
          )}
        </ul>
      )}

      <CreateWorksheetDialog
        open={isCreateWorksheetOpen}
        onOpenChange={setIsCreateWorksheetOpen}
        serverId={serverId}
        initialFolderId={folder.id}
        onCreated={(worksheet) =>
          openWorksheetTab({ worksheetId: worksheet.id, worksheetName: worksheet.name })
        }
      />

      <RenameFolderDialog
        open={isRenameOpen}
        onOpenChange={setIsRenameOpen}
        serverId={serverId}
        folderId={folder.id}
        currentName={folder.name}
      />

      <DeleteFolderConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        serverId={serverId}
        folderId={folder.id}
        folderName={folder.name}
        worksheetCount={worksheets.length}
      />
    </li>
  )
}
