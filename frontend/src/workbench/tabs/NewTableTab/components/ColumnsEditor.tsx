import { Plus, Trash2 } from 'lucide-react'
import { COMMON_DATA_TYPES, type FormColumn } from '../types'

type ColumnsEditorProps = {
  columns: FormColumn[]
  onAddColumn: () => void
  onRemoveColumn: (id: string) => void
  onUpdateColumn: (id: string, updates: Partial<FormColumn>) => void
}

export function ColumnsEditor({
  columns,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumn,
}: ColumnsEditorProps) {
  return (
    <div className="px-4 py-4 border-b border-border/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Columns
        </h3>
        <button
          type="button"
          onClick={onAddColumn}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Column
        </button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-2 py-2 text-center font-medium text-muted-foreground w-10">PK</th>
              <th className="px-2 py-2 text-center font-medium text-muted-foreground w-14">
                Not Null
              </th>
              <th className="px-2 py-2 text-center font-medium text-muted-foreground w-14">
                Unique
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Default</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {columns.map((col) => (
              <tr key={col.id} className="hover:bg-muted/20">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => onUpdateColumn(col.id, { name: e.target.value })}
                    placeholder="column_name"
                    className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={col.dataType}
                    onChange={(e) => onUpdateColumn(col.id, { dataType: e.target.value })}
                    className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                  >
                    {COMMON_DATA_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={col.primaryKey}
                    onChange={(e) => onUpdateColumn(col.id, { primaryKey: e.target.checked })}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={col.notNull}
                    onChange={(e) => onUpdateColumn(col.id, { notNull: e.target.checked })}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={col.unique}
                    onChange={(e) => onUpdateColumn(col.id, { unique: e.target.checked })}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={col.defaultValue}
                    onChange={(e) => onUpdateColumn(col.id, { defaultValue: e.target.value })}
                    placeholder="e.g. 0, 'value', NOW()"
                    className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                  />
                </td>
                <td className="px-2 py-2">
                  {columns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveColumn(col.id)}
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
