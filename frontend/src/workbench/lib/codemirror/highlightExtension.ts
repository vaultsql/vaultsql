import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

// Define a state effect for setting the highlight range
export const setHighlight = StateEffect.define<{ from: number; to: number } | null>()

// Create a state field to manage highlight decorations
export const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,

  update(decorations, tr) {
    // Map existing decorations through document changes
    decorations = decorations.map(tr.changes)

    // Check for highlight effects
    for (const effect of tr.effects) {
      if (effect.is(setHighlight)) {
        if (effect.value === null) {
          // Clear all highlights
          return Decoration.none
        }

        // Create line decorations for all lines in the range
        const { from, to } = effect.value
        const doc = tr.state.doc
        const fromLine = doc.lineAt(from)
        const toLine = doc.lineAt(to)

        const decorationRanges = []
        for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
          const line = doc.line(lineNum)
          decorationRanges.push(Decoration.line({ class: 'cm-run-highlight' }).range(line.from))
        }

        return Decoration.set(decorationRanges)
      }
    }

    return decorations
  },

  provide: (f) => EditorView.decorations.from(f),
})

// Helper function to create the highlight extension
export function createHighlightExtension() {
  return [highlightField]
}
