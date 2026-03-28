import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/catalyst/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useCreateFolder,
  useCreateWorksheet,
  useDeleteFolder,
  useDeleteWorksheet,
  useFolders,
  useUpdateFolder,
  useUpdateWorksheet,
  type Worksheet,
} from '@/queries/worksheets'

type CreateWorksheetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  initialFolderId?: string | null
  onCreated?: (worksheet: Worksheet) => void
}

export function CreateWorksheetDialog({
  open,
  onOpenChange,
  serverId,
  initialFolderId = null,
  onCreated,
}: CreateWorksheetDialogProps) {
  const { data: folders = [], isLoading: foldersLoading } = useFolders(serverId)
  const createWorksheet = useCreateWorksheet(serverId)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState(initialFolderId ?? '')

  useEffect(() => {
    if (open) {
      setFolderId(initialFolderId ?? '')
      return
    }
    setName('')
    setFolderId(initialFolderId ?? '')
  }, [open, initialFolderId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const worksheet = await createWorksheet.mutateAsync({
      name: trimmedName || 'Untitled',
      folder_id: folderId ? folderId : undefined,
    })
    setName('')
    setFolderId(initialFolderId ?? '')
    onOpenChange(false)
    onCreated?.(worksheet)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New worksheet</DialogTitle>
          <DialogDescription>Create a worksheet and choose an optional folder.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="worksheet-name" className="text-sm font-medium">
              Worksheet name
            </label>
            <input
              id="worksheet-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Untitled"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="worksheet-folder" className="text-sm font-medium">
              Folder <span className="text-muted-foreground">(optional)</span>
            </label>
            <select
              id="worksheet-folder"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              disabled={foldersLoading}
            >
              <option value="">Root folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWorksheet.isPending}>
              Create worksheet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type CreateFolderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
}

export function CreateFolderDialog({ open, onOpenChange, serverId }: CreateFolderDialogProps) {
  const createFolder = useCreateFolder(serverId)
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) {
      setName('')
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }
    await createFolder.mutateAsync({ name: trimmedName })
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>Create a folder to organize worksheets.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="folder-name" className="text-sm font-medium">
              Folder name
            </label>
            <input
              id="folder-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Release analysis"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createFolder.isPending}>
              Create folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type MoveWorksheetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  worksheetId: string
  currentFolderId: string | null
}

export function MoveWorksheetDialog({
  open,
  onOpenChange,
  serverId,
  worksheetId,
  currentFolderId,
}: MoveWorksheetDialogProps) {
  const { data: folders = [], isLoading: foldersLoading } = useFolders(serverId)
  const updateWorksheet = useUpdateWorksheet(serverId)
  const [folderId, setFolderId] = useState(currentFolderId ?? '')
  const currentKey = useMemo(() => currentFolderId ?? '', [currentFolderId])
  const hasChange = folderId !== currentKey

  useEffect(() => {
    if (open) {
      setFolderId(currentFolderId ?? '')
    }
  }, [open, currentFolderId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!hasChange) {
      onOpenChange(false)
      return
    }

    await updateWorksheet.mutateAsync({
      worksheetId,
      payload: {
        folder_id: folderId ? folderId : null,
      },
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move worksheet</DialogTitle>
          <DialogDescription>Choose a folder or leave it at the root.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="move-worksheet-folder" className="text-sm font-medium">
              Folder <span className="text-muted-foreground">(optional)</span>
            </label>
            <select
              id="move-worksheet-folder"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              disabled={foldersLoading}
            >
              <option value="">Root folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!hasChange || updateWorksheet.isPending}>
              Move worksheet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type SaveAsWorksheetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  content: string
  onSaved?: (worksheet: Worksheet) => void
}

export function SaveAsWorksheetDialog({
  open,
  onOpenChange,
  serverId,
  content,
  onSaved,
}: SaveAsWorksheetDialogProps) {
  const { data: folders = [], isLoading: foldersLoading } = useFolders(serverId)
  const createWorksheet = useCreateWorksheet(serverId)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState('')

  useEffect(() => {
    if (!open) {
      setName('')
      setFolderId('')
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const worksheet = await createWorksheet.mutateAsync({
      name: trimmedName || 'Untitled',
      content,
      folder_id: folderId ? folderId : undefined,
    })
    setName('')
    setFolderId('')
    onOpenChange(false)
    onSaved?.(worksheet)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as worksheet</DialogTitle>
          <DialogDescription>
            Save your SQL as a worksheet and choose an optional folder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="save-worksheet-name" className="text-sm font-medium">
              Worksheet name
            </label>
            <input
              id="save-worksheet-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Untitled"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="save-worksheet-folder" className="text-sm font-medium">
              Folder <span className="text-muted-foreground">(optional)</span>
            </label>
            <select
              id="save-worksheet-folder"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              disabled={foldersLoading}
            >
              <option value="">Root folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWorksheet.isPending}>
              Save worksheet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Rename Worksheet Dialog ============

type RenameWorksheetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  worksheetId: string
  currentName: string
}

export function RenameWorksheetDialog({
  open,
  onOpenChange,
  serverId,
  worksheetId,
  currentName,
}: RenameWorksheetDialogProps) {
  const updateWorksheet = useUpdateWorksheet(serverId)
  const [name, setName] = useState(currentName)

  useEffect(() => {
    if (open) {
      setName(currentName)
    }
  }, [open, currentName])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || trimmedName === currentName) {
      onOpenChange(false)
      return
    }

    await updateWorksheet.mutateAsync({
      worksheetId,
      payload: { name: trimmedName },
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename worksheet</DialogTitle>
          <DialogDescription>Enter a new name for this worksheet.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="rename-worksheet-name" className="text-sm font-medium">
              Worksheet name
            </label>
            <input
              id="rename-worksheet-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Worksheet name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName || updateWorksheet.isPending}
            >
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Delete Worksheet Confirm Dialog ============

type DeleteWorksheetConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  worksheetId: string
  worksheetName: string
  onDeleted?: () => void
}

export function DeleteWorksheetConfirmDialog({
  open,
  onOpenChange,
  serverId,
  worksheetId,
  worksheetName,
  onDeleted,
}: DeleteWorksheetConfirmDialogProps) {
  const deleteWorksheet = useDeleteWorksheet(serverId)

  const handleDelete = async () => {
    await deleteWorksheet.mutateAsync(worksheetId)
    onOpenChange(false)
    onDeleted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete worksheet</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-medium">{worksheetName}</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" outline onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            color="red"
            onClick={handleDelete}
            disabled={deleteWorksheet.isPending}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Rename Folder Dialog ============

type RenameFolderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  folderId: string
  currentName: string
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  serverId,
  folderId,
  currentName,
}: RenameFolderDialogProps) {
  const updateFolder = useUpdateFolder(serverId)
  const [name, setName] = useState(currentName)

  useEffect(() => {
    if (open) {
      setName(currentName)
    }
  }, [open, currentName])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || trimmedName === currentName) {
      onOpenChange(false)
      return
    }

    await updateFolder.mutateAsync({
      folderId,
      payload: { name: trimmedName },
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
          <DialogDescription>Enter a new name for this folder.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="rename-folder-name" className="text-sm font-medium">
              Folder name
            </label>
            <input
              id="rename-folder-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Folder name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" outline onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName || updateFolder.isPending}
            >
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============ Delete Folder Confirm Dialog ============

type DeleteFolderConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId: string
  folderId: string
  folderName: string
  worksheetCount: number
  onDeleted?: () => void
}

export function DeleteFolderConfirmDialog({
  open,
  onOpenChange,
  serverId,
  folderId,
  folderName,
  worksheetCount,
  onDeleted,
}: DeleteFolderConfirmDialogProps) {
  const deleteFolder = useDeleteFolder(serverId)

  const handleDelete = async () => {
    await deleteFolder.mutateAsync(folderId)
    onOpenChange(false)
    onDeleted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-medium">{folderName}</span>?
            {worksheetCount > 0 && (
              <span className="mt-1 block text-amber-500">
                This folder contains {worksheetCount} worksheet{worksheetCount === 1 ? '' : 's'}{' '}
                that will also be deleted.
              </span>
            )}
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" outline onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            color="red"
            onClick={handleDelete}
            disabled={deleteFolder.isPending}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
