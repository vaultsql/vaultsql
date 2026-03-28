import { ClockIcon, LayersIcon } from 'lucide-react'
import { useState } from 'react'
import { HistoryModal } from '../components/HistoryModal'
import { useWorkbench } from '../context/useWorkbench'
import { useSchemasStore } from '../features/schema-browser/useSchemasStore'
import { StatusBarItem } from './StatusBarItem'
import { useCommandPalette } from './useCommandPalette'

function getDatabaseLabel(databaseType: string): string {
  return databaseType === 'postgres' ? 'PostgreSQL' : databaseType === 'mysql' ? 'MySQL' : databaseType
}

export function StatusBar() {
  const { databaseType } = useWorkbench()
  const activeSchema = useSchemasStore((state) => state.activeSchema)
  const openSchemaSelector = useCommandPalette((state) => state.openSchemaSelector)
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <div className="wb-statusbar">
        <StatusBarItem label={getDatabaseLabel(databaseType)} />

        <div className="mx-1 h-3 w-px bg-zinc-300 dark:bg-zinc-600" />

        <StatusBarItem
          icon={LayersIcon}
          label={activeSchema ?? 'No schema'}
          onClick={openSchemaSelector}
          showChevron
        />

        <div className="flex-1" />

        <StatusBarItem
          icon={ClockIcon}
          label="History"
          onClick={() => setHistoryOpen(true)}
          showChevron
        />
      </div>

      <HistoryModal open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  )
}
