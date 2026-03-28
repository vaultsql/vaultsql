import { autocompletion } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { EditorView as EditorViewExt } from '@codemirror/view'
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { Download, FolderOpen, Play, PlayCircle, Save } from 'lucide-react'
import { useRef } from 'react'
import { ToolbarButton, ToolbarSeparator } from '@/components/workbench'
import { CodeMirrorEditor } from '../../components/CodeMirrorEditor'
import { createHighlightExtension } from '../../lib/codemirror/highlightExtension'
import { sqlCompletionSource } from '../../lib/codemirror/sqlCompletions'

type WorksheetPaneProps = {
  worksheetName: string
  value: string
  onChange: (value: string) => void
  onRunQuery: () => void
  onMoveWorksheet: () => void
  onSaveWorksheet: () => void
  isDraft: boolean
  isRunning: boolean
  onEditorCreate?: (view: EditorView) => void
  onCursorChange?: () => void
  onFocusChange?: (focused: boolean) => void
}

export function WorksheetPane({
  worksheetName,
  value,
  onChange,
  onRunQuery,
  onMoveWorksheet,
  onSaveWorksheet,
  isDraft,
  isRunning,
  onEditorCreate,
  onCursorChange,
  onFocusChange,
}: WorksheetPaneProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)

  // Create extensions for the editor
  const extensions = [
    // SQL autocompletion
    autocompletion({
      override: [sqlCompletionSource],
    }),
    // Highlight extension for run line
    ...createHighlightExtension(),
    // Cursor position tracking
    EditorViewExt.updateListener.of((update) => {
      if (update.selectionSet && onCursorChange) {
        onCursorChange()
      }
    }),
    // Focus/blur tracking
    EditorViewExt.domEventHandlers({
      focus: () => {
        if (onFocusChange) {
          onFocusChange(true)
        }
      },
      blur: () => {
        if (onFocusChange) {
          onFocusChange(false)
        }
      },
    }),
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="wb-toolbar justify-between">
        <div className="flex items-center gap-0.5">
          {/* Save */}
          {isDraft ? (
            <ToolbarButton
              icon={Save}
              label="Save"
              title="Save as worksheet"
              onClick={onSaveWorksheet}
            />
          ) : (
            <ToolbarButton
              icon={Save}
              label="Save"
              title="Auto-saving"
              onClick={() => {}}
              disabled
            />
          )}

          {/* Move - only for persisted worksheets */}
          {!isDraft && (
            <ToolbarButton
              icon={FolderOpen}
              label="Move"
              title="Move worksheet"
              onClick={onMoveWorksheet}
            />
          )}

          <ToolbarSeparator />

          {/* Run Line */}
          <ToolbarButton
            icon={Play}
            label="Run Line"
            title="Run statement at cursor"
            onClick={onRunQuery}
            disabled={isRunning}
          />

          {/* Run File */}
          <ToolbarButton
            icon={PlayCircle}
            label="Run File"
            title="Run entire file"
            onClick={() => {}}
          />

          <ToolbarSeparator />

          {/* Download */}
          <ToolbarButton
            icon={Download}
            label="Download"
            title="Download results"
            onClick={() => {}}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{worksheetName}</span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[#1e1e1e]">
        <CodeMirrorEditor
          ref={editorRef}
          value={value}
          onChange={onChange}
          onCreateEditor={onEditorCreate}
          extensions={extensions}
          height="100%"
        />
      </div>
    </div>
  )
}
