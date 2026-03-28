import type { DatabaseAdapterFactory, DatabaseInfo } from '@/workbench/types/database'
import { mysqlAdapterFactory } from './mysql'
import { postgresAdapterFactory } from './postgres'

const adapterFactories: Record<DatabaseInfo['type'], DatabaseAdapterFactory> = {
  postgres: postgresAdapterFactory,
  mysql: mysqlAdapterFactory,
}

export function getDatabaseAdapterFactory(
  type: DatabaseInfo['type'],
): DatabaseAdapterFactory | undefined {
  return adapterFactories[type]
}

export type {
  ColumnCategory,
  ColumnInfo,
  DatabaseAdapter,
  DatabaseAdapterFactory,
  IndexInfo,
  TableStructure,
} from '@/workbench/types/database'
