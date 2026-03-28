type TableNameSectionProps = {
  schema: string
  tableName: string
  schemaNames: string[]
  onSchemaChange: (schema: string) => void
  onTableNameChange: (tableName: string) => void
}

export function TableNameSection({
  schema,
  tableName,
  schemaNames,
  onSchemaChange,
  onTableNameChange,
}: TableNameSectionProps) {
  return (
    <div className="px-4 py-4 border-b border-border/50 space-y-4">
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="space-y-1.5">
          <label htmlFor="table-schema" className="text-xs font-medium text-muted-foreground">
            Schema
          </label>
          <select
            id="table-schema"
            value={schema}
            onChange={(e) => onSchemaChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {schemaNames.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="table-name" className="text-xs font-medium text-muted-foreground">
            Table Name
          </label>
          <input
            id="table-name"
            type="text"
            value={tableName}
            onChange={(e) => onTableNameChange(e.target.value)}
            placeholder="my_table"
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  )
}
