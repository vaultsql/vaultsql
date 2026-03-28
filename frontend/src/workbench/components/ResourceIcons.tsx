import { Code2, Eye, FileCode2, Table } from 'lucide-react'
import type { SchemaObjectType } from '@/workbench/types/database'

type ResourceIconProps = {
  className?: string
}

export function TableResourceIcon({ className = 'h-3.5 w-3.5' }: ResourceIconProps) {
  return <Table className={`${className} text-blue-500`} />
}

export function FunctionResourceIcon({ className = 'h-3.5 w-3.5' }: ResourceIconProps) {
  return <Code2 className={`${className} text-purple-500`} />
}

export function ProcedureResourceIcon({ className = 'h-3.5 w-3.5' }: ResourceIconProps) {
  return <FileCode2 className={`${className} text-amber-500`} />
}

export function ViewResourceIcon({ className = 'h-3.5 w-3.5' }: ResourceIconProps) {
  return <Eye className={`${className} text-green-500`} />
}

export function MaterializedViewResourceIcon({ className = 'h-3.5 w-3.5' }: ResourceIconProps) {
  return <Eye className={`${className} text-purple-500`} />
}

export function RoutineResourceIcon({
  objectType,
  className = 'h-3.5 w-3.5',
}: ResourceIconProps & { objectType: SchemaObjectType }) {
  if (objectType === 'function') {
    return <FunctionResourceIcon className={className} />
  }
  if (objectType === 'procedure') {
    return <ProcedureResourceIcon className={className} />
  }
  return <Code2 className={className} />
}
