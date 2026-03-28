import { AlertTriangle } from 'lucide-react'
import type { TabDescriptor } from '../useTabsStore'
import { ColumnsEditor } from './components/ColumnsEditor'
import { ForeignKeysEditor } from './components/ForeignKeysEditor'
import { IndexesEditor } from './components/IndexesEditor'
import { SqlPreviewFooter } from './components/SqlPreviewFooter'
import { TableNameSection } from './components/TableNameSection'
import { useNewTableForm } from './hooks/useNewTableForm'

type NewTableTabProps = {
  tab: TabDescriptor
}

export function NewTableTab({ tab }: NewTableTabProps) {
  const form = useNewTableForm(tab)

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-3">
        <h1 className="text-sm font-medium">Create New Table</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Define the structure for your new table
        </p>
      </div>

      <form onSubmit={form.handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto">
          {/* Table Name Section */}
          <TableNameSection
            schema={form.schema}
            tableName={form.tableName}
            schemaNames={form.schemaNames}
            onSchemaChange={form.setSchema}
            onTableNameChange={form.setTableName}
          />

          {/* Columns Section */}
          <ColumnsEditor
            columns={form.columns}
            onAddColumn={form.addColumn}
            onRemoveColumn={form.removeColumn}
            onUpdateColumn={form.updateColumn}
          />

          {/* Indexes Section (collapsible) */}
          <IndexesEditor
            indexes={form.indexes}
            availableColumns={form.availableColumns}
            isOpen={form.indexesOpen}
            onToggleOpen={() => form.setIndexesOpen(!form.indexesOpen)}
            onAddIndex={form.addIndex}
            onRemoveIndex={form.removeIndex}
            onUpdateIndex={form.updateIndex}
            onToggleIndexColumn={form.toggleIndexColumn}
          />

          {/* Foreign Keys Section (collapsible) */}
          <ForeignKeysEditor
            foreignKeys={form.foreignKeys}
            availableColumns={form.availableColumns}
            schemaNames={form.schemaNames}
            refTables={form.refTables}
            refColumns={form.refColumns}
            isOpen={form.foreignKeysOpen}
            onToggleOpen={() => form.setForeignKeysOpen(!form.foreignKeysOpen)}
            onAddForeignKey={form.addForeignKey}
            onRemoveForeignKey={form.removeForeignKey}
            onUpdateForeignKey={form.updateForeignKey}
            onLoadRefTables={form.loadRefTables}
            onLoadRefColumns={form.loadRefColumnsData}
          />

          {/* Error display */}
          {form.error && (
            <div className="mx-4 my-4 flex items-start gap-2 rounded-md bg-red-950/30 border border-red-900/50 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 break-all">{form.error}</p>
            </div>
          )}
        </div>

        {/* SQL Preview & Footer */}
        <SqlPreviewFooter
          sqlPreview={form.sqlPreview}
          isValid={form.isValid}
          isSubmitting={form.isSubmitting}
          onSubmit={form.handleSubmit}
          onCancel={form.handleCancel}
        />
      </form>
    </div>
  )
}
