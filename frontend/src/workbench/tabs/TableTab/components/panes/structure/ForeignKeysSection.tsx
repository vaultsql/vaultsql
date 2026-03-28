import { Link2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import type { ForeignKeyInfo } from '@/workbench/types/database'

type ForeignKeysSectionProps = {
  foreignKeys: ForeignKeyInfo[]
  onAddForeignKey: () => void
  onDropForeignKey: (fk: ForeignKeyInfo) => void
  readOnly?: boolean
}

export function ForeignKeysSection({
  foreignKeys,
  onAddForeignKey,
  onDropForeignKey,
  readOnly = false,
}: ForeignKeysSectionProps) {
  if (foreignKeys.length === 0) {
    return (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="h-4 w-4" />
            Foreign Keys
          </h3>
          {!readOnly && (
            <Button outline compact onClick={onAddForeignKey} title="Add Foreign Key">
              <Plus data-slot="icon" />
              Add Foreign Key
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">No foreign keys defined</p>
      </section>
    )
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="h-4 w-4" />
          Foreign Keys
          <span className="text-xs font-normal text-muted-foreground">({foreignKeys.length})</span>
        </h3>
        {!readOnly && (
          <Button outline compact onClick={onAddForeignKey} title="Add Foreign Key">
            <Plus data-slot="icon" />
            Add Foreign Key
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Constraint
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Column
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                References
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                On Update
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                On Delete
              </th>
              {!readOnly && (
                <th className="w-auto px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {foreignKeys.map((fk) => (
              <tr key={`${fk.constraintName}-${fk.column}`} className="group hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{fk.constraintName}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{fk.column}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {fk.refSchema}.{fk.refTable}.{fk.refColumn}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fk.onUpdate}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fk.onDelete}</td>
                {!readOnly && (
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onDropForeignKey(fk)}
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-red-400 group-hover:opacity-100"
                        title="Drop foreign key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
