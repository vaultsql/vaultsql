import { useStructurePane } from '../../hooks/useStructurePane'
import { useTableTabContext } from '../../state/TableTabContext'
import { ColumnModal } from '../dialogs/ColumnModal'
import { DeleteColumnModal } from '../dialogs/DeleteColumnModal'
import { DeleteForeignKeyModal } from '../dialogs/DeleteForeignKeyModal'
import { DeleteIndexModal } from '../dialogs/DeleteIndexModal'
import { ForeignKeyModal } from '../dialogs/ForeignKeyModal'
import { IndexModal } from '../dialogs/IndexModal'
import { RenameColumnModal } from '../dialogs/RenameColumnModal'
import { ColumnsSection, ForeignKeysSection, IndexesSection } from './structure'
import { ViewDefinitionPane } from './ViewDefinitionPane'

type StructurePaneProps = {
  schema: string
  table: string
}

export function StructurePane({ schema, table }: StructurePaneProps) {
  const { isView, canUpdateStructure, canSeeIndexes, canSeeForeignKeys } = useTableTabContext()
  const {
    structure,
    loadState,
    error,
    columnActions,
    indexActions,
    foreignKeyActions,
    modals,
    handleSuccess,
  } = useStructurePane({
    schema,
    table,
  })

  // For views, show the view definition instead of structure
  if (isView) {
    return <ViewDefinitionPane schema={schema} view={table} />
  }

  if (loadState === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading structure…</p>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="text-sm text-rose-600">Failed to load structure</p>
          <p className="mt-1 text-xs text-rose-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!structure) {
    return null
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-4">
      <ColumnsSection
        columns={structure.columns}
        onAddColumn={columnActions.add}
        onEditColumn={columnActions.edit}
        onRenameColumn={columnActions.rename}
        onDeleteColumn={columnActions.delete}
        readOnly={!canUpdateStructure}
      />
      {canSeeIndexes && (
        <IndexesSection
          indexes={structure.indexes}
          onAddIndex={indexActions.add}
          onDropIndex={indexActions.delete}
          readOnly={!canUpdateStructure}
        />
      )}
      {canSeeForeignKeys && (
        <ForeignKeysSection
          foreignKeys={structure.foreignKeys}
          onAddForeignKey={foreignKeyActions.add}
          onDropForeignKey={foreignKeyActions.delete}
          readOnly={!canUpdateStructure}
        />
      )}

      {/* Column modals */}
      <ColumnModal
        open={modals.column.open}
        onOpenChange={modals.column.setOpen}
        schema={schema}
        table={table}
        mode={modals.column.mode}
        column={modals.column.column}
        onSuccess={handleSuccess}
      />

      {modals.rename.column && (
        <RenameColumnModal
          open={modals.rename.open}
          onOpenChange={modals.rename.setOpen}
          schema={schema}
          table={table}
          column={modals.rename.column}
          onSuccess={handleSuccess}
        />
      )}

      {modals.delete.column && (
        <DeleteColumnModal
          open={modals.delete.open}
          onClose={() => modals.delete.setOpen(false)}
          schema={schema}
          table={table}
          column={modals.delete.column}
          onSuccess={handleSuccess}
        />
      )}

      {/* Index modals */}
      <IndexModal
        open={modals.index.open}
        onOpenChange={modals.index.setOpen}
        schema={schema}
        table={table}
        columns={structure.columns}
        onSuccess={handleSuccess}
      />

      {modals.deleteIndex.index && (
        <DeleteIndexModal
          open={modals.deleteIndex.open}
          onClose={() => modals.deleteIndex.setOpen(false)}
          schema={schema}
          table={table}
          index={modals.deleteIndex.index}
          onSuccess={handleSuccess}
        />
      )}

      {/* Foreign key modals */}
      <ForeignKeyModal
        open={modals.foreignKey.open}
        onOpenChange={modals.foreignKey.setOpen}
        schema={schema}
        table={table}
        columns={structure.columns}
        onSuccess={handleSuccess}
      />

      {modals.deleteForeignKey.foreignKey && (
        <DeleteForeignKeyModal
          open={modals.deleteForeignKey.open}
          onClose={() => modals.deleteForeignKey.setOpen(false)}
          schema={schema}
          table={table}
          foreignKey={modals.deleteForeignKey.foreignKey}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
