export function extractPrimaryKey(
  row: Record<string, unknown>,
  pkColumns: string[] = ['id'],
): Record<string, unknown> {
  const pk: Record<string, unknown> = {}

  for (const col of pkColumns) {
    if (col in row) {
      pk[col] = row[col]
    }
  }

  return pk
}

export function primaryKeysMatch(
  pk1: Record<string, unknown>,
  pk2: Record<string, unknown>,
): boolean {
  const keys1 = Object.keys(pk1).sort()
  const keys2 = Object.keys(pk2).sort()

  if (keys1.length !== keys2.length) {
    return false
  }

  return keys1.every((key, i) => {
    return keys2[i] === key && pk1[key] === pk2[key]
  })
}
