import type { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUpdateWorksheet, useWorksheet } from '@/queries/worksheets'
import { useWorkbench } from '../../context/useWorkbench'
import {
  MoveWorksheetDialog,
  SaveAsWorksheetDialog,
} from '../../features/worksheets/WorksheetModals'
import { setHighlight } from '../../lib/codemirror/highlightExtension'
import type { TabDescriptor } from '../useTabsStore'
import { useTabsStore } from '../useTabsStore'
import { QueryResultsPane } from './QueryResultsPane'
import { ResultTabPage } from './ResultTabPage'
import { useWorksheetData } from './useWorksheetData'
import { WorksheetPane } from './WorksheetPane'

const AUTO_SAVE_DELAY_MS = 1000

type WorksheetTabProps = {
  tab: TabDescriptor
}

export function WorksheetTab({ tab }: WorksheetTabProps) {
  const worksheetId = ('worksheetId' in tab.config ? tab.config.worksheetId : null) ?? null
  const initialContent = ('initialContent' in tab.config ? tab.config.initialContent : null) ?? null
  const isDraft = !worksheetId

  const { data: worksheet } = useWorksheet(worksheetId ?? '', {
    enabled: Boolean(worksheetId),
  })
  const { serverId } = useWorkbench()
  const updateTab = useTabsStore((state) => state.updateTab)
  const pinTab = useTabsStore((state) => state.pinTab)
  const editorViewRef = useRef<EditorView | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string | null>(null)
  const localContentRef = useRef<string | null>(null)
  const runHighlightRangeRef = useRef<{ start: number; end: number } | null>(null)
  const isEditorFocusedRef = useRef(false)
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
  const [isSaveAsDialogOpen, setIsSaveAsDialogOpen] = useState(false)

  const updateWorksheetMutation = useUpdateWorksheet(serverId)
  const data = useWorksheetData()

  // Initialize last saved content and local content
  useEffect(() => {
    if (isDraft && lastSavedContentRef.current === null) {
      // Initialize draft with initial content (if provided) or empty
      const draftContent = initialContent ?? ''
      lastSavedContentRef.current = draftContent
      localContentRef.current = draftContent
    } else if (worksheet && lastSavedContentRef.current === null) {
      lastSavedContentRef.current = worksheet.content
      localContentRef.current = worksheet.content
    }
  }, [worksheet, isDraft, initialContent])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const clearRunHighlight = useCallback(() => {
    const view = editorViewRef.current
    if (!view) {
      return
    }

    view.dispatch({
      effects: setHighlight.of(null),
    })
    runHighlightRangeRef.current = null
  }, [])

  const applyRunHighlight = useCallback((startOffset: number, endOffset: number) => {
    if (
      runHighlightRangeRef.current?.start === startOffset &&
      runHighlightRangeRef.current?.end === endOffset
    ) {
      return
    }

    const view = editorViewRef.current

    if (!view) {
      return
    }

    view.dispatch({
      effects: setHighlight.of({ from: startOffset, to: endOffset }),
    })
    runHighlightRangeRef.current = { start: startOffset, end: endOffset }
  }, [])

  const updateHighlightForCursor = useCallback(() => {
    const view = editorViewRef.current

    if (!view) {
      clearRunHighlight()
      return null
    }

    const cursorOffset = view.state.selection.main.head
    const statement = extractStatementAtCursor(view.state.doc.toString(), cursorOffset)

    if (!statement) {
      clearRunHighlight()
      return null
    }

    if (isEditorFocusedRef.current) {
      applyRunHighlight(statement.start, statement.end)
    } else {
      clearRunHighlight()
    }
    return statement
  }, [applyRunHighlight, clearRunHighlight])

  const handleEditorCreate = useCallback(
    (view: EditorView) => {
      editorViewRef.current = view

      // Check if editor has focus initially
      isEditorFocusedRef.current = view.hasFocus

      // Update highlight initially
      updateHighlightForCursor()
    },
    [updateHighlightForCursor],
  )

  const handleContentChange = useCallback(
    (value: string) => {
      // Update local ref immediately
      localContentRef.current = value

      // Skip auto-save for drafts
      if (isDraft) {
        return
      }

      if (!worksheet) return

      // Debounce API save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        // Only save if content actually changed from last saved
        if (value !== lastSavedContentRef.current) {
          lastSavedContentRef.current = value
          updateWorksheetMutation.mutate({
            worksheetId: worksheet.id,
            payload: { content: value },
          })
        }
      }, AUTO_SAVE_DELAY_MS)
    },
    [worksheet, updateWorksheetMutation, isDraft],
  )

  const handleRunQuery = useCallback(() => {
    const statement = updateHighlightForCursor()

    if (!statement) {
      return
    }

    // Pin the tab when user runs a query
    if (tab.isPreview) {
      pinTab(tab.id)
    }

    void data.executeQuery(statement.text)
  }, [updateHighlightForCursor, data, tab, pinTab])

  const handleSaveAsWorksheet = useCallback(
    (worksheet: { id: string; name: string }) => {
      // Pin the tab when saving a worksheet
      if (tab.isPreview) {
        pinTab(tab.id)
      }

      // Update tab config to convert from draft to persisted worksheet
      updateTab(tab.id, {
        title: worksheet.name,
        config: { worksheetId: worksheet.id },
      })
    },
    [tab, updateTab, pinTab],
  )

  if (!isDraft && !worksheet) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Worksheet not found. Choose another worksheet from the sidebar.
        </p>
      </div>
    )
  }

  const worksheetName = isDraft ? 'SQL' : (worksheet?.name ?? 'Untitled')
  const content =
    localContentRef.current ?? (isDraft ? (initialContent ?? '') : (worksheet?.content ?? ''))

  return (
    <>
      <ResultTabPage
        worksheetPane={
          <WorksheetPane
            worksheetName={worksheetName}
            value={content}
            onChange={handleContentChange}
            onRunQuery={handleRunQuery}
            onMoveWorksheet={() => setIsMoveDialogOpen(true)}
            onSaveWorksheet={() => setIsSaveAsDialogOpen(true)}
            isDraft={isDraft}
            isRunning={data.isLoading}
            onEditorCreate={handleEditorCreate}
            onCursorChange={updateHighlightForCursor}
            onFocusChange={(focused) => {
              isEditorFocusedRef.current = focused
              if (focused) {
                updateHighlightForCursor()
              } else {
                clearRunHighlight()
              }
            }}
          />
        }
        resultsPane={
          <QueryResultsPane status={data.status} error={data.error} lastResponse={data.result} />
        }
      />
      {!isDraft && worksheet && (
        <MoveWorksheetDialog
          open={isMoveDialogOpen}
          onOpenChange={setIsMoveDialogOpen}
          serverId={serverId}
          worksheetId={worksheet.id}
          currentFolderId={worksheet.folder_id}
        />
      )}
      {isDraft && (
        <SaveAsWorksheetDialog
          open={isSaveAsDialogOpen}
          onOpenChange={setIsSaveAsDialogOpen}
          serverId={serverId}
          content={content}
          onSaved={handleSaveAsWorksheet}
        />
      )}
    </>
  )
}

type StatementSegment = {
  start: number
  end: number
  text: string
}

function extractStatementAtCursor(value: string, cursorOffset: number): StatementSegment | null {
  if (!value.trim()) {
    return null
  }

  const statements: Array<{ start: number; end: number; text: string }> = []
  let segmentStart = 0

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === ';') {
      const end = index + 1
      statements.push({
        start: segmentStart,
        end,
        text: value.slice(segmentStart, end),
      })
      segmentStart = end
    }
  }

  if (segmentStart < value.length) {
    statements.push({
      start: segmentStart,
      end: value.length,
      text: value.slice(segmentStart),
    })
  }

  if (statements.length === 0) {
    statements.push({
      start: 0,
      end: value.length,
      text: value,
    })
  }

  const segment = statements.find(({ start, end }) => {
    if (cursorOffset === end && cursorOffset > 0 && value[cursorOffset - 1] === ';') {
      return true
    }

    return cursorOffset >= start && cursorOffset < end
  })

  if (!segment) {
    return null
  }

  const rawText = value.slice(segment.start, segment.end)
  const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0
  const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0
  const trimmedStart = segment.start + leadingWhitespace
  const trimmedEnd = segment.end - trailingWhitespace

  if (trimmedEnd <= trimmedStart) {
    return null
  }

  return {
    start: trimmedStart,
    end: trimmedEnd,
    text: value.slice(trimmedStart, trimmedEnd),
  } satisfies StatementSegment
}
