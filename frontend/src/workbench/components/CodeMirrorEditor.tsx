import { sql } from '@codemirror/lang-sql'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { forwardRef } from 'react'

type CodeMirrorEditorProps = {
  value: string
  onChange: (value: string) => void
  onCreateEditor?: (view: EditorView) => void
  extensions?: Extension[]
  height?: string
}

export const CodeMirrorEditor = forwardRef<ReactCodeMirrorRef, CodeMirrorEditorProps>(
  ({ value, onChange, onCreateEditor, extensions = [], height = '100%' }, ref) => {
    const allExtensions = [sql(), ...extensions]

    return (
      <CodeMirror
        ref={ref}
        value={value}
        height={height}
        theme={vscodeDark}
        extensions={allExtensions}
        onChange={(val) => onChange(val)}
        onCreateEditor={(view) => {
          if (onCreateEditor) {
            onCreateEditor(view)
          }
        }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: false,
          highlightSpecialChars: true,
          history: true,
          foldGutter: false,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
          tabSize: 2,
        }}
      />
    )
  },
)

CodeMirrorEditor.displayName = 'CodeMirrorEditor'
