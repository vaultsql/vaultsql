import { Database, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import type { IndexInfo } from '@/workbench/types/database'

type IndexesSectionProps = {
  indexes: IndexInfo[]
  onAddIndex: () => void
  onDropIndex: (index: IndexInfo) => void
  readOnly?: boolean
}

export function IndexesSection({
  indexes,
  onAddIndex,
  onDropIndex,
  readOnly = false,
}: IndexesSectionProps) {
  if (indexes.length === 0) {
    return (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="h-4 w-4" />
            Indexes
          </h3>
          {!readOnly && (
            <Button outline compact onClick={onAddIndex} title="Add Index">
              <Plus data-slot="icon" />
              Add Index
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">No indexes defined</p>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Database className="h-4 w-4" />
          Indexes
          <span className="text-xs font-normal text-muted-foreground">({indexes.length})</span>
        </h3>
        {!readOnly && (
          <Button outline compact onClick={onAddIndex} title="Add Index">
            <Plus data-slot="icon" />
            Add Index
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Columns
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Type
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Properties
              </th>
              {!readOnly && (
                <th className="w-auto px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {indexes.map((index) => (
              <tr key={index.name} className="group hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{index.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {index.columns.join(', ')}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{index.type}</td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex gap-1">
                    {index.isPrimary && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        PRIMARY
                      </span>
                    )}
                    {index.isUnique && !index.isPrimary && (
                      <span className="inline-flex items-center rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                        UNIQUE
                      </span>
                    )}
                  </div>
                </td>
                {!readOnly && (
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end">
                      {/* Don't allow dropping primary key indexes */}
                      {!index.isPrimary && (
                        <button
                          type="button"
                          onClick={() => onDropIndex(index)}
                          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-red-400 group-hover:opacity-100"
                          title="Drop index"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
