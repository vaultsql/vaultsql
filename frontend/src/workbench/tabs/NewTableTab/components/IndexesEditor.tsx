import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { FormIndex } from '../types'

type IndexesEditorProps = {
  indexes: FormIndex[]
  availableColumns: string[]
  isOpen: boolean
  onToggleOpen: () => void
  onAddIndex: () => void
  onRemoveIndex: (id: string) => void
  onUpdateIndex: (id: string, updates: Partial<FormIndex>) => void
  onToggleIndexColumn: (indexId: string, columnName: string) => void
}

export function IndexesEditor({
  indexes,
  availableColumns,
  isOpen,
  onToggleOpen,
  onAddIndex,
  onRemoveIndex,
  onUpdateIndex,
  onToggleIndexColumn,
}: IndexesEditorProps) {
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
            Indexes
          </h3>
          {indexes.length > 0 && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{indexes.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddIndex()
          }}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </button>

      {isOpen && indexes.length > 0 && (
        <div className="mt-3 space-y-3">
          {indexes.map((idx) => (
            <div
              key={idx.id}
              className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={idx.name}
                    onChange={(e) => onUpdateIndex(idx.id, { name: e.target.value })}
                    placeholder="Auto-generated if empty"
                    className="w-full rounded border border-border/50 bg-background px-2 py-1.5 text-xs font-mono outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id={`idx-unique-${idx.id}`}
                    checked={idx.unique}
                    onChange={(e) => onUpdateIndex(idx.id, { unique: e.target.checked })}
                    className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                  />
                  <label htmlFor={`idx-unique-${idx.id}`} className="text-xs cursor-pointer">
                    Unique
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveIndex(idx.id)}
                  className="p-1 text-muted-foreground hover:text-red-400 transition-colors mt-4"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground">Columns</label>
                <div className="flex flex-wrap gap-2">
                  {availableColumns.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Add columns first</span>
                  ) : (
                    availableColumns.map((colName) => (
                      <label
                        key={colName}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-xs font-mono transition-colors ${
                          idx.columns.includes(colName)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/50 hover:border-border'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={idx.columns.includes(colName)}
                          onChange={() => onToggleIndexColumn(idx.id, colName)}
                          className="sr-only"
                        />
                        {colName}
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
