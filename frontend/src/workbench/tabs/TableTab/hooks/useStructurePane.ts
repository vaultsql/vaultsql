import { useCallback, useEffect, useState } from 'react'
import { useWorkbench } from '../../../context/useWorkbench'
import type { ColumnInfo, ForeignKeyInfo, IndexInfo } from '../../../types/database'
import { useTableStructureStore } from '../state/useTableStructureStore'

type UseStructurePaneParams = {
  schema: string
  table: string
}

type ColumnModalState = {
  open: boolean
  mode: 'add' | 'edit'
  column?: ColumnInfo
}

type RenameModalState = {
  open: boolean
  column?: ColumnInfo
}

type DeleteModalState = {
  open: boolean
  column?: ColumnInfo
}

type IndexModalState = {
  open: boolean
}

type DeleteIndexModalState = {
  open: boolean
  index?: IndexInfo
}

type ForeignKeyModalState = {
  open: boolean
}

type DeleteForeignKeyModalState = {
  open: boolean
  foreignKey?: ForeignKeyInfo
}

export function useStructurePane({ schema, table }: UseStructurePaneParams) {
  const { db } = useWorkbench()
  const entry = useTableStructureStore((state) => state.getEntry(schema, table))
  const beginLoad = useTableStructureStore((state) => state.beginLoad)
  const setStructure = useTableStructureStore((state) => state.setStructure)
  const setError = useTableStructureStore((state) => state.setError)
  const invalidate = useTableStructureStore((state) => state.invalidate)

  const loadState = entry?.status ?? 'idle'
  const structure = entry?.structure ?? null
  const error = entry?.error ?? null

  // Column modal state
  const [columnModal, setColumnModal] = useState<ColumnModalState>({
    open: false,
    mode: 'add',
    column: undefined,
  })

  // Rename column modal state
  const [renameModal, setRenameModal] = useState<RenameModalState>({
    open: false,
    column: undefined,
  })

  // Delete column modal state
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    open: false,
    column: undefined,
  })

  // Index modal state
  const [indexModal, setIndexModal] = useState<IndexModalState>({
    open: false,
  })

  // Delete index modal state
  const [deleteIndexModal, setDeleteIndexModal] = useState<DeleteIndexModalState>({
    open: false,
    index: undefined,
  })

  // Foreign key modal state
  const [foreignKeyModal, setForeignKeyModal] = useState<ForeignKeyModalState>({
    open: false,
  })

  // Delete foreign key modal state
  const [deleteForeignKeyModal, setDeleteForeignKeyModal] = useState<DeleteForeignKeyModalState>({
    open: false,
    foreignKey: undefined,
  })

  const loadStructure = useCallback(() => {
    beginLoad(schema, table)

    db.describeTable(schema, table)
      .then((result) => {
        setStructure(schema, table, result)
      })
      .catch((err) => {
        setError(schema, table, err instanceof Error ? err.message : 'Failed to load structure')
      })
  }, [schema, table, db, beginLoad, setStructure, setError])

  useEffect(() => {
    const currentEntry = useTableStructureStore.getState().getEntry(schema, table)

    // Skip if already loading or loaded
    if (currentEntry?.status === 'loading' || currentEntry?.status === 'success') {
      return
    }

    loadStructure()
  }, [schema, table, loadStructure])

  // Column actions
  const columnActions = {
    add: useCallback(() => {
      setColumnModal({ open: true, mode: 'add', column: undefined })
    }, []),

    edit: useCallback((column: ColumnInfo) => {
      setColumnModal({ open: true, mode: 'edit', column })
    }, []),

    rename: useCallback((column: ColumnInfo) => {
      setRenameModal({ open: true, column })
    }, []),

    delete: useCallback((column: ColumnInfo) => {
      setDeleteModal({ open: true, column })
    }, []),
  }

  // Index actions
  const indexActions = {
    add: useCallback(() => {
      setIndexModal({ open: true })
    }, []),

    delete: useCallback((index: IndexInfo) => {
      setDeleteIndexModal({ open: true, index })
    }, []),
  }

  // Foreign key actions
  const foreignKeyActions = {
    add: useCallback(() => {
      setForeignKeyModal({ open: true })
    }, []),

    delete: useCallback((foreignKey: ForeignKeyInfo) => {
      setDeleteForeignKeyModal({ open: true, foreignKey })
    }, []),
  }

  // Modal controls
  const modals = {
    column: {
      ...columnModal,
      setOpen: useCallback((open: boolean) => {
        setColumnModal((prev) => ({ ...prev, open }))
      }, []),
    },
    rename: {
      ...renameModal,
      setOpen: useCallback((open: boolean) => {
        setRenameModal((prev) => ({ ...prev, open }))
      }, []),
    },
    delete: {
      ...deleteModal,
      setOpen: useCallback((open: boolean) => {
        setDeleteModal((prev) => ({ ...prev, open }))
      }, []),
    },
    index: {
      ...indexModal,
      setOpen: useCallback((open: boolean) => {
        setIndexModal((prev) => ({ ...prev, open }))
      }, []),
    },
    deleteIndex: {
      ...deleteIndexModal,
      setOpen: useCallback((open: boolean) => {
        setDeleteIndexModal((prev) => ({ ...prev, open }))
      }, []),
    },
    foreignKey: {
      ...foreignKeyModal,
      setOpen: useCallback((open: boolean) => {
        setForeignKeyModal((prev) => ({ ...prev, open }))
      }, []),
    },
    deleteForeignKey: {
      ...deleteForeignKeyModal,
      setOpen: useCallback((open: boolean) => {
        setDeleteForeignKeyModal((prev) => ({ ...prev, open }))
      }, []),
    },
  }

  const handleSuccess = useCallback(() => {
    invalidate(schema, table)
    loadStructure()
  }, [invalidate, schema, table, loadStructure])

  return {
    structure,
    loadState,
    error,
    columnActions,
    indexActions,
    foreignKeyActions,
    modals,
    handleSuccess,
  }
}
