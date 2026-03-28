import { useCallback } from 'react'
import type { Filter } from '@/workbench/types/database'
import { toFilterInputs } from '@/workbench/types/database'
import { useTabsStore } from '../../../useTabsStore'
import { useTableTabActions, useTableTabContext } from '../../state/TableTabContext'

export function useFilterToolbar() {
  const { store, columns, tab } = useTableTabContext()
  const { applyFilters, applyRawSql, clearFilters } = useTableTabActions()
  const updateTabFilterMode = useTabsStore((s) => s.updateTabFilterMode)

  const filters = store((s) => s.filters)
  const rawSqlWhere = store((s) => s.rawSqlWhere)
  const filterMode = store((s) => s.filterMode)
  const setFilters = store((s) => s.setFilters)
  const setRawSqlWhere = store((s) => s.setRawSqlWhere)
  const setFilterMode = store((s) => s.setFilterMode)

  const handleUpdateFilter = useCallback(
    (updated: Filter) => {
      const newFilters = filters.map((f) => (f.id === updated.id ? updated : f))
      setFilters(newFilters)
      // Auto-apply when updating a filter (convert to FilterInput by removing id)
      applyFilters(toFilterInputs(newFilters))
    },
    [filters, setFilters, applyFilters],
  )

  const handleRemoveFilter = useCallback(
    (id: string) => {
      const newFilters = filters.filter((f) => f.id !== id)
      setFilters(newFilters)
      // Auto-apply when removing a filter (convert to FilterInput by removing id)
      applyFilters(toFilterInputs(newFilters))
    },
    [filters, setFilters, applyFilters],
  )

  const handleAddFilter = useCallback(
    (filter: Filter) => {
      const newFilters = [...filters, filter]
      setFilters(newFilters)
      // Auto-apply when adding a filter (convert to FilterInput by removing id)
      applyFilters(toFilterInputs(newFilters))
    },
    [filters, setFilters, applyFilters],
  )

  const handleClearFilters = useCallback(() => {
    clearFilters()
  }, [clearFilters])

  const handleApplyRawSql = useCallback(
    (sql: string) => {
      setRawSqlWhere(sql)
      applyRawSql(sql)
    },
    [applyRawSql, setRawSqlWhere],
  )

  const handleRemoveRawSql = useCallback(() => {
    setRawSqlWhere(null)
    // Re-apply with just structured filters (convert to FilterInput by removing id)
    applyFilters(toFilterInputs(filters))
  }, [setRawSqlWhere, applyFilters, filters])

  const handleSetFilterMode = useCallback(
    (mode: 'all' | 'any') => {
      setFilterMode(mode)
      // Persist to tab config
      updateTabFilterMode(tab.id, mode)
      // Re-apply filters with new mode (convert to FilterInput by removing id)
      applyFilters(toFilterInputs(filters))
    },
    [setFilterMode, updateTabFilterMode, tab.id, applyFilters, filters],
  )

  return {
    filters,
    columns,
    rawSqlWhere,
    filterMode,
    onUpdateFilter: handleUpdateFilter,
    onRemoveFilter: handleRemoveFilter,
    onAddFilter: handleAddFilter,
    onClear: handleClearFilters,
    onApplyRawSql: handleApplyRawSql,
    onRemoveRawSql: handleRemoveRawSql,
    onSetFilterMode: handleSetFilterMode,
  }
}
