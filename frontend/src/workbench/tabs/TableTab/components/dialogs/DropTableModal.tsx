import { useMemo, useState } from 'react'
import { DangerousQueryDialog } from '@/workbench/components/DangerousQueryDialog'
import { useWorkbench } from '@/workbench/context/useWorkbench'
import { useColumnsStore } from '@/workbench/features/schema-browser/useColumnsStore'
import { useSchemaLoader } from '@/workbench/features/schema-browser/useSchemaLoader'
import { useTabsStore } from '@/workbench/tabs/useTabsStore'
import { useTableStructureStore } from '../../state/useTableStructureStore'

type DropTableModalProps = {
  open: boolean
  onClose: () => void
  schema: string
  table: string
  tabId: string
}

export function DropTableModal({ open, onClose, schema, table, tabId }: DropTableModalProps) {
  const { db } = useWorkbench()
  const { loadSchemaAssets } = useSchemaLoader()
  const closeTab = useTabsStore((state) => state.closeTab)
  const invalidateStructure = useTableStructureStore((state) => state.invalidate)
  const invalidateColumns = useColumnsStore((state) => state.invalidateTable)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build SQL preview
  const sqlPreview = useMemo(() => {
    try {
      const result = db.buildDropTableQuery({
        schema,
        table,
      })
      return result.sql
    } catch {
      return '-- Invalid configuration'
    }
  }, [db, schema, table])

  const handleConfirm = async () => {
    if (!sqlPreview || sqlPreview.startsWith('--')) {
      onClose()
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await db.query(sqlPreview, {
        actor: 'table',
        operation: 'drop_table',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to drop table')
        setIsSubmitting(false)
        return
      }

      // Invalidate caches
      invalidateStructure(schema, table)
      invalidateColumns(schema, table)

      // Refresh schema browser to remove the table from the list
      void loadSchemaAssets(schema)

      // Close the tab
      closeTab(tabId)

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DangerousQueryDialog
      open={open}
      onClose={onClose}
      title="Drop table"
      description="This will permanently delete the table and all its data. This action cannot be undone."
      operation="DROP TABLE"
      targetName={`${schema}.${table}`}
      sqlPreview={sqlPreview}
      confirmLabel="Drop table"
      onConfirm={handleConfirm}
      error={error}
      isSubmitting={isSubmitting}
    />
  )
}
