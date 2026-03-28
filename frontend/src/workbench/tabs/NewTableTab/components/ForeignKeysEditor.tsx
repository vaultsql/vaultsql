import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { ColumnInfo, WorkbenchAsset } from '@/workbench/types/database'
import { FK_ACTIONS, type FormForeignKey } from '../types'

type ForeignKeysEditorProps = {
  foreignKeys: FormForeignKey[]
  availableColumns: string[]
  schemaNames: string[]
  refTables: Map<string, WorkbenchAsset[]>
  refColumns: Map<string, ColumnInfo[]>
  isOpen: boolean
  onToggleOpen: () => void
  onAddForeignKey: () => void
  onRemoveForeignKey: (id: string) => void
  onUpdateForeignKey: (id: string, updates: Partial<FormForeignKey>) => void
  onLoadRefTables: (schemaName: string) => void
  onLoadRefColumns: (schemaName: string, tableName: string) => void
}

export function ForeignKeysEditor({
  foreignKeys,
  availableColumns,
  schemaNames,
  refTables,
  refColumns,
  isOpen,
  onToggleOpen,
  onAddForeignKey,
  onRemoveForeignKey,
  onUpdateForeignKey,
  onLoadRefTables,
  onLoadRefColumns,
}: ForeignKeysEditorProps) {
  return (
    <div className="px-4 py-3 border-b border-border/50">
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`}
          />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Foreign Keys
          </h3>
          {foreignKeys.length > 0 && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{foreignKeys.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddForeignKey()
          }}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </button>

      {isOpen && foreignKeys.length > 0 && (
        <div className="mt-3 space-y-3">
          {foreignKeys.map((fk) => (
            <div
              key={fk.id}
              className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-4 gap-3">
                  {/* Column */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground">Column</label>
                    <select
                      value={fk.column}
                      onChange={(e) => onUpdateForeignKey(fk.id, { column: e.target.value })}
                      className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                    >
                      <option value="">Select...</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ref Schema */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground">
                      Ref Schema
                    </label>
                    <select
                      value={fk.refSchema}
                      onChange={(e) => {
                        onUpdateForeignKey(fk.id, {
                          refSchema: e.target.value,
                          refTable: '',
                          refColumn: '',
                        })
                        onLoadRefTables(e.target.value)
                      }}
                      className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                    >
                      <option value="">Select...</option>
                      {schemaNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ref Table */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground">
                      Ref Table
                    </label>
                    <select
                      value={fk.refTable}
                      onChange={(e) => {
                        onUpdateForeignKey(fk.id, {
                          refTable: e.target.value,
                          refColumn: '',
                        })
                        onLoadRefColumns(fk.refSchema, e.target.value)
                      }}
                      disabled={!fk.refSchema}
                      className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {(refTables.get(fk.refSchema) ?? []).map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ref Column */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground">
                      Ref Column
                    </label>
                    <select
                      value={fk.refColumn}
                      onChange={(e) => onUpdateForeignKey(fk.id, { refColumn: e.target.value })}
                      disabled={!fk.refTable}
                      className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="">Select...</option>
                      {(refColumns.get(`${fk.refSchema}.${fk.refTable}`) ?? []).map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveForeignKey(fk.id)}
                  className="p-1 text-muted-foreground hover:text-red-400 transition-colors mt-4"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">On Delete</label>
                  <select
                    value={fk.onDelete}
                    onChange={(e) =>
                      onUpdateForeignKey(fk.id, {
                        onDelete: e.target.value as FormForeignKey['onDelete'],
                      })
                    }
                    className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    {FK_ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">On Update</label>
                  <select
                    value={fk.onUpdate}
                    onChange={(e) =>
                      onUpdateForeignKey(fk.id, {
                        onUpdate: e.target.value as FormForeignKey['onUpdate'],
                      })
                    }
                    className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    {FK_ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
