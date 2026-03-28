import { Key, Pencil, Plus, Table, TextCursorInput, Trash2 } from 'lucide-react'
import { Button } from '@/components/catalyst/button'
import {
  ToolbarDropdownItem,
  ToolbarDropdownMenu,
  ToolbarSplitButtonGroup,
} from '@/components/workbench'
import type { ColumnInfo } from '@/workbench/types/database'

type ColumnsSectionProps = {
  columns: ColumnInfo[]
  onAddColumn: () => void
  onEditColumn: (column: ColumnInfo) => void
  onRenameColumn: (column: ColumnInfo) => void
  onDeleteColumn: (column: ColumnInfo) => void
  readOnly?: boolean
}

export function ColumnsSection({
  columns,
  onAddColumn,
  onEditColumn,
  onRenameColumn,
  onDeleteColumn,
  readOnly = false,
}: ColumnsSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Table className="h-4 w-4" />
          Columns
          <span className="text-xs font-normal text-muted-foreground">({columns.length})</span>
        </h3>
        {!readOnly && (
          <Button outline compact onClick={onAddColumn} title="Add Column">
            <Plus data-slot="icon" />
            Add Column
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
                Type
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Nullable
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                Default
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Key</th>
              {!readOnly && (
                <th className="w-auto px-2 py-2 text-right text-xs font-medium text-muted-foreground">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {columns.map((column) => (
              <tr key={column.name} className="group hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">
                  {column.name}
                  {column.comment && (
                    <span className="ml-2 text-muted-foreground" title={column.comment}>
                      💬
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {column.dataType}
                </td>
                <td className="px-3 py-2 text-xs">
                  {column.nullable ? (
                    <span className="text-muted-foreground">NULL</span>
                  ) : (
                    <span className="text-amber-500">NOT NULL</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {column.defaultValue ?? <span className="opacity-50">—</span>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {column.isPrimaryKey && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      <Key className="h-3 w-3" />
                      PK
                    </span>
                  )}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end">
                      <ToolbarSplitButtonGroup
                        icon={Pencil}
                        label="Edit"
                        title="Edit column properties"
                        onClick={() => onEditColumn(column)}
                      >
                        <ToolbarDropdownMenu>
                          <ToolbarDropdownItem onClick={() => onRenameColumn(column)}>
                            <TextCursorInput data-slot="icon" />
                            Rename
                          </ToolbarDropdownItem>
                          <ToolbarDropdownItem onClick={() => onDeleteColumn(column)}>
                            <Trash2 data-slot="icon" />
                            Drop Column
                          </ToolbarDropdownItem>
                        </ToolbarDropdownMenu>
                      </ToolbarSplitButtonGroup>
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
