import { Copy, FolderInput, Pencil, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useCreateWorksheet, useWorksheet, type Worksheet } from '@/queries/worksheets'
import { FileIcon } from '../../components/SidebarTree'
import { useWorkbench } from '../../context/useWorkbench'
import { openWorksheetTab } from '../../tabs/controllers/openWorksheetTab'
import { useTabsStore } from '../../tabs/useTabsStore'
import {
  DeleteWorksheetConfirmDialog,
  MoveWorksheetDialog,
  RenameWorksheetDialog,
} from './WorksheetModals'

export type WorksheetItemProps = {
  worksheet: Worksheet
}

export function WorksheetItem({ worksheet }: WorksheetItemProps) {
  const { serverId } = useWorkbench()
  const closeTab = useTabsStore((state) => state.closeTab)
  const createWorksheet = useCreateWorksheet(serverId)

  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isMoveOpen, setIsMoveOpen] = useState(false)

  // Use the worksheet query to get content for duplication (lazy load only when needed)
  const { refetch: fetchWorksheet } = useWorksheet(worksheet.id, { enabled: false })

  const handleOpen = () => {
    openWorksheetTab({ worksheetId: worksheet.id, worksheetName: worksheet.name, preview: false })
  }

  const handleDuplicate = async () => {
    // Fetch the full worksheet data to get the content
    const { data } = await fetchWorksheet()
    if (data) {
      const duplicatedWorksheet = await createWorksheet.mutateAsync({
        name: `${worksheet.name} (copy)`,
        content: data.content,
        folder_id: worksheet.folder_id ?? undefined,
      })
      openWorksheetTab({
        worksheetId: duplicatedWorksheet.id,
        worksheetName: duplicatedWorksheet.name,
        preview: false,
      })
    }
  }

  const handleDeleted = () => {
    // Close the tab if it's open
    closeTab(`worksheet:${worksheet.id}`)
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() =>
              openWorksheetTab({
                worksheetId: worksheet.id,
                worksheetName: worksheet.name,
                preview: true,
              })
            }
            onDoubleClick={() =>
              openWorksheetTab({
                worksheetId: worksheet.id,
                worksheetName: worksheet.name,
                preview: false,
              })
            }
            className="wb-tree-row wb-tree-row-inactive"
          >
            <FileIcon className="h-4 w-4 flex-shrink-0 wb-tree-icon" />
            <span className="truncate font-sans">{worksheet.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={handleOpen}>
            <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
            Open
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setIsRenameOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setIsMoveOpen(true)}>
            <FolderInput className="mr-2 h-4 w-4" />
            Move to Folder
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

      <RenameWorksheetDialog
        open={isRenameOpen}
        onOpenChange={setIsRenameOpen}
        serverId={serverId}
        worksheetId={worksheet.id}
        currentName={worksheet.name}
      />

      <DeleteWorksheetConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        serverId={serverId}
        worksheetId={worksheet.id}
        worksheetName={worksheet.name}
        onDeleted={handleDeleted}
      />

      <MoveWorksheetDialog
        open={isMoveOpen}
        onOpenChange={setIsMoveOpen}
        serverId={serverId}
        worksheetId={worksheet.id}
        currentFolderId={worksheet.folder_id}
      />
    </li>
  )
}
