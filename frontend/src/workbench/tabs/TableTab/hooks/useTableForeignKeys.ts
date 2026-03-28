import { useEffect } from 'react'
import type { ForeignKeyInfo } from '@/workbench/types/database'
import { useWorkbench } from '../../../context/useWorkbench'
import { useTableStructureStore } from '../state/useTableStructureStore'

type UseTableForeignKeysParams = {
  schema: string
  table: string
}

const EMPTY_FOREIGN_KEYS: ForeignKeyInfo[] = []

export function useTableForeignKeys({ schema, table }: UseTableForeignKeysParams) {
  const { db } = useWorkbench()
  const entry = useTableStructureStore((state) => state.getEntry(schema, table))
  const beginLoad = useTableStructureStore((state) => state.beginLoad)
  const setStructure = useTableStructureStore((state) => state.setStructure)
  const setError = useTableStructureStore((state) => state.setError)

  useEffect(() => {
    const currentEntry = useTableStructureStore.getState().getEntry(schema, table)

    // Skip if already loading or loaded
    if (currentEntry?.status === 'loading' || currentEntry?.status === 'success') {
      return
    }

    beginLoad(schema, table)

    db.describeTable(schema, table)
      .then((result) => {
        setStructure(schema, table, result)
      })
      .catch((err) => {
        setError(schema, table, err instanceof Error ? err.message : 'Failed to load structure')
      })
  }, [schema, table, db, beginLoad, setStructure, setError])

  return entry?.structure.foreignKeys ?? EMPTY_FOREIGN_KEYS
}
