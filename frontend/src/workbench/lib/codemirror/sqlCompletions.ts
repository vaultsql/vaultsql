import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { useColumnsStore } from '../../features/schema-browser/useColumnsStore'
import { useSchemasStore } from '../../features/schema-browser/useSchemasStore'

const SQL_KEYWORDS = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'INSERT',
  'UPDATE',
  'DELETE',
  'JOIN',
  'LEFT',
  'RIGHT',
  'INNER',
  'OUTER',
  'ON',
  'GROUP BY',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
  'AS',
  'DISTINCT',
  'COUNT',
  'SUM',
  'AVG',
  'MAX',
  'MIN',
  'NULL',
  'NOT',
  'IN',
  'LIKE',
  'BETWEEN',
  'EXISTS',
  'HAVING',
  'UNION',
  'ALL',
  'CREATE',
  'ALTER',
  'DROP',
  'TABLE',
  'INDEX',
  'VIEW',
  'SET',
  'VALUES',
  'INTO',
]

export function sqlCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\w*/)

  // Don't show completions if there's no word and it's not explicit
  if (!word || (word.from === word.to && !context.explicit)) {
    return null
  }

  const options: Completion[] = []

  // Add SQL keywords
  for (const kw of SQL_KEYWORDS) {
    options.push({
      label: kw,
      type: 'keyword',
      apply: kw,
    })
  }

  // Add table names from schemas store
  const { assets } = useSchemasStore.getState()
  for (const asset of assets) {
    options.push({
      label: asset.name,
      type: asset.type === 'table' ? 'class' : 'interface',
      apply: asset.name,
      detail: asset.type,
    })
  }

  // Add column names from columns store
  const { columns } = useColumnsStore.getState()
  for (const [tableKey, cols] of columns) {
    for (const col of cols) {
      options.push({
        label: col.name,
        type: 'property',
        apply: col.name,
        detail: `${tableKey}.${col.dataType}`,
      })
    }
  }

  return {
    from: word.from,
    options,
  }
}
