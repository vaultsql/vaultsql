import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { Button } from '@/components/catalyst/button'
import { Input, InputGroup } from '@/components/catalyst/input'
import { Select } from '@/components/catalyst/select'
import type { AccessFilter, EnvironmentFilter } from './types'
import { capitalize } from './utils'

interface DatabaseFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  accessFilter: AccessFilter
  onAccessFilterChange: (value: AccessFilter) => void
  environmentFilter: EnvironmentFilter
  onEnvironmentFilterChange: (value: EnvironmentFilter) => void
  availableEnvironments: string[]
  hasOtherEnvironment: boolean
  filteredCount: number
  totalCount: number
  onClearFilters: () => void
}

export function DatabaseFilters({
  searchQuery,
  onSearchChange,
  accessFilter,
  onAccessFilterChange,
  environmentFilter,
  onEnvironmentFilterChange,
  availableEnvironments,
  hasOtherEnvironment,
  filteredCount,
  totalCount,
  onClearFilters,
}: DatabaseFiltersProps) {
  const hasActiveFilters = searchQuery || accessFilter !== 'all' || environmentFilter !== 'all'

  return (
    <div className="w-full max-w-xl space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <InputGroup>
          <MagnifyingGlassIcon data-slot="icon" className="size-4" />
          <Input
            type="search"
            placeholder="Search databases or accounts..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </InputGroup>
        <Select
          value={accessFilter}
          onChange={(event) => onAccessFilterChange(event.target.value as AccessFilter)}
        >
          <option value="all">All access</option>
          <option value="pending">Pending requests</option>
          <option value="no-access">No access</option>
        </Select>
        <Select
          value={environmentFilter}
          onChange={(event) => onEnvironmentFilterChange(event.target.value as EnvironmentFilter)}
        >
          <option value="all">All environments</option>
          {availableEnvironments.map((environment) => (
            <option key={environment} value={environment}>
              {capitalize(environment)}
            </option>
          ))}
          {hasOtherEnvironment && <option value="other">Other / Unset</option>}
        </Select>
      </div>
      {hasActiveFilters && (
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            Showing {filteredCount} of {totalCount} databases
          </span>
          <Button plain compact onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}
