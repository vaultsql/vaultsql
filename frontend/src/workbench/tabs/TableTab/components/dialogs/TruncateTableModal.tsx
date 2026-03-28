import { useMemo, useState } from 'react'
import { DangerousQueryDialog } from '@/workbench/components/DangerousQueryDialog'
import { useWorkbench } from '@/workbench/context/useWorkbench'

type TruncateTableModalProps = {
  open: boolean
  onClose: () => void
  schema: string
  table: string
  onSuccess?: () => void
}

export function TruncateTableModal({
  open,
  onClose,
  schema,
  table,
  onSuccess,
}: TruncateTableModalProps) {
  const { db } = useWorkbench()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build SQL preview - include RESTART IDENTITY for PostgreSQL
  const sqlPreview = useMemo(() => {
    try {
      const result = db.buildTruncateTableQuery({
        schema,
        table,
        restartIdentity: db.type === 'postgresql',
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
        operation: 'truncate_table',
      })

      if (!response.success) {
        setError(response.error ?? 'Failed to truncate table')
        setIsSubmitting(false)
        return
      }

      onSuccess?.()
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
      title="Truncate table"
      description="This will permanently delete all rows from the table. This action cannot be undone."
      operation="TRUNCATE"
      targetName={`${schema}.${table}`}
      sqlPreview={sqlPreview}
      confirmLabel="Truncate table"
      onConfirm={handleConfirm}
      error={error}
      isSubmitting={isSubmitting}
    />
  )
}
