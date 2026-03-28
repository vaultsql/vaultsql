function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

function escapeValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export { quoteIdentifier, escapeValue }
