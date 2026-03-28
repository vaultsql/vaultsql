import type { EditorView } from '@codemirror/view'
import { Save } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ToolbarButton } from '@/components/workbench'
import { CodeMirrorEditor } from '../../components/CodeMirrorEditor'
import { useWorkbench } from '../../context/useWorkbench'
import type { RoutineTabConfig, TabDescriptor } from '../useTabsStore'

type RoutineTabProps = {
  tab: TabDescriptor
}

export function RoutineTab({ tab }: RoutineTabProps) {
  const config = tab.config as RoutineTabConfig
  const { db } = useWorkbench()
  const editorViewRef = useRef<EditorView | null>(null)
  const [definition, setDefinition] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load the routine definition
  useEffect(() => {
    let mounted = true

    const loadDefinition = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const def = await db.getObjectDefinition(
          config.schema,
          config.objectName,
          config.objectType,
        )
        if (mounted) {
          setDefinition(def)
          setIsLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load routine definition')
          setIsLoading(false)
        }
      }
    }

    void loadDefinition()

    return () => {
      mounted = false
    }
  }, [db, config.schema, config.objectName, config.objectType])

  const handleSave = useCallback(async () => {
    if (!definition.trim()) {
      setSaveError('Cannot save empty definition')
      return
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Transform the SQL to use CREATE OR REPLACE
      let sqlToExecute = definition.trim()

      // For PostgreSQL, replace CREATE FUNCTION/PROCEDURE with CREATE OR REPLACE
      if (db.type === 'postgres') {
        sqlToExecute = sqlToExecute.replace(
          /^CREATE\s+(FUNCTION|PROCEDURE)/i,
          'CREATE OR REPLACE $1',
        )
      } else if (db.type === 'mysql') {
        // For MySQL, we need to drop first, then create
        const dropStatement =
          config.objectType === 'function'
            ? `DROP FUNCTION IF EXISTS \`${config.schema}\`.\`${config.objectName}\`;`
            : `DROP PROCEDURE IF EXISTS \`${config.schema}\`.\`${config.objectName}\`;`

        sqlToExecute = `${dropStatement}\n${sqlToExecute}`
      }

      await db.query(sqlToExecute, {
        actor: 'user',
        operation: `save_${config.objectType}`,
      })

      setSaveSuccess(true)
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save routine')
    } finally {
      setIsSaving(false)
    }
  }, [definition, db, config.schema, config.objectName, config.objectType])

  const handleEditorCreate = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading {config.objectType}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Error loading {config.objectType}</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="wb-toolbar justify-between">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={Save}
            label="Save"
            title={`Save ${config.objectType}`}
            onClick={handleSave}
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-green-600 dark:text-green-400">Saved successfully</span>
          )}
          {saveError && <span className="text-xs text-red-500">{saveError}</span>}
          <span className="text-xs text-muted-foreground">
            {config.objectType === 'function' ? 'Function' : 'Procedure'}: {config.objectName}
          </span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#1e1e1e]">
        <CodeMirrorEditor
          value={definition}
          onChange={setDefinition}
          onCreateEditor={handleEditorCreate}
          height="100%"
        />
      </div>
    </div>
  )
}
