import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Heading } from '@/components/catalyst/heading'
import { Text } from '@/components/catalyst/text'
import { type Access, isAccessActive, isAccessPending, useUserAccounts } from '@/queries/access'
import { useClearDemoDatabases, useDatabases } from '@/queries/databases'
import { useIsAdmin } from '@/queries/user'
import { LoadingSpinner } from '@/webapp/components'
import { usePageTitle } from '@/webapp/hooks'
import { DatabaseFilters } from './home/DatabaseFilters'
import { DatabaseList } from './home/DatabaseList'
import type { AccessFilter, EnvironmentFilter } from './home/types'

export function HomePage() {
  usePageTitle('Home')
  const { data: accessList = [], isLoading: accessLoading, error: accessError } = useUserAccounts()
  const {
    data: databases = [],
    isLoading: databasesLoading,
    error: databasesError,
  } = useDatabases()
  const isAdmin = useIsAdmin()
  const [searchQuery, setSearchQuery] = useState('')
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all')
  const [environmentFilter, setEnvironmentFilter] = useState<EnvironmentFilter>('all')

  // Map of account_id -> access (active access only)
  const accessByAccount = useMemo(() => {
    const map = new Map<string, Access>()
    for (const access of accessList) {
      if (isAccessActive(access) && !map.has(access.account_id)) {
        map.set(access.account_id, access)
      }
    }
    return map
  }, [accessList])

  // Map of account_id -> pending access request
  const pendingByAccount = useMemo(() => {
    const map = new Map<string, Access>()
    for (const access of accessList) {
      if (isAccessPending(access) && !map.has(access.account_id)) {
        map.set(access.account_id, access)
      }
    }
    return map
  }, [accessList])

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const knownEnvironments = ['production', 'staging', 'testing', 'development']
  const availableEnvironments = useMemo(() => {
    const found = new Set<string>()
    for (const database of databases) {
      if (database.environment) {
        found.add(database.environment.toLowerCase())
      }
    }
    return knownEnvironments.filter((env) => found.has(env))
  }, [databases])

  const hasOtherEnvironment = useMemo(() => {
    return databases.some((database) => {
      if (!database.environment) return true
      return !knownEnvironments.includes(database.environment.toLowerCase())
    })
  }, [databases])

  const filteredDatabases = useMemo(() => {
    return databases.filter((database) => {
      if (environmentFilter !== 'all') {
        const env = database.environment?.toLowerCase()
        if (environmentFilter === 'other') {
          if (env && knownEnvironments.includes(env)) return false
        } else if (env !== environmentFilter) {
          return false
        }
      }

      if (normalizedSearch) {
        const haystack = [
          database.name,
          database.description ?? '',
          database.database_type ?? '',
          database.environment ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(normalizedSearch)) return false
      }

      return true
    })
  }, [databases, environmentFilter, normalizedSearch])

  const hasDemoDatabases = useMemo(() => {
    return databases.some((db) => db.is_demo)
  }, [databases])

  const clearDemo = useClearDemoDatabases()

  const handleClearDemo = () => {
    clearDemo.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Removed ${data.deleted_count} demo database(s)`)
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to remove demo databases')
      },
    })
  }

  const isLoading = accessLoading || databasesLoading
  const error = accessError ?? databasesError

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="p-8">
        <Heading>Home</Heading>
        <Text className="mt-2 text-sm text-red-600">Failed to load access: {error.message}</Text>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="px-6 py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Heading className="text-2xl">Database Access</Heading>
            <Text className="mt-1 text-zinc-500 dark:text-zinc-400">
              {isAdmin
                ? 'Connect to databases you have access to.'
                : 'Connect to databases you have access to, or request access.'}
            </Text>
          </div>
          <DatabaseFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            accessFilter={accessFilter}
            onAccessFilterChange={setAccessFilter}
            environmentFilter={environmentFilter}
            onEnvironmentFilterChange={setEnvironmentFilter}
            availableEnvironments={availableEnvironments}
            hasOtherEnvironment={hasOtherEnvironment}
            filteredCount={filteredDatabases.length}
            totalCount={databases.length}
            onClearFilters={() => {
              setSearchQuery('')
              setAccessFilter('all')
              setEnvironmentFilter('all')
            }}
          />
        </div>
      </div>

      {/* Database List */}
      <div className="px-6 pb-4">
        <DatabaseList
          databases={databases}
          filteredDatabases={filteredDatabases}
          accessByAccount={accessByAccount}
          pendingByAccount={pendingByAccount}
          searchQuery={normalizedSearch}
          accessFilter={accessFilter}
        />
      </div>

      {/* Demo Banner */}
      {hasDemoDatabases && isAdmin && (
        <div className="mx-6 mb-10 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-900 dark:bg-purple-950/50">
          <p className="text-sm text-purple-800 dark:text-purple-200">
            Ready to connect your own databases?{' '}
            <a
              href="/databases/new"
              className="font-medium text-purple-700 hover:underline dark:text-purple-300"
            >
              Add a database
            </a>
            {' '}or{' '}
            <button
              type="button"
              onClick={handleClearDemo}
              disabled={clearDemo.isPending}
              className="font-medium text-purple-700 hover:underline disabled:opacity-50 dark:text-purple-300"
            >
              {clearDemo.isPending ? 'removing...' : 'remove demo connections'}
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
