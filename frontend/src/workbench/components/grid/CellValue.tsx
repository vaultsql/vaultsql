const MAX_JSON_LENGTH = 200

export function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">NULL</span>
  }

  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value)
    const displayStr =
      jsonStr.length > MAX_JSON_LENGTH ? `${jsonStr.substring(0, MAX_JSON_LENGTH)}...` : jsonStr
    return (
      <span className="text-xs text-muted-foreground" title={jsonStr}>
        {displayStr}
      </span>
    )
  }

  return <span>{String(value)}</span>
}
