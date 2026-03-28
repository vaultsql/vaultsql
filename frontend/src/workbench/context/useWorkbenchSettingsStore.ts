import { create } from 'zustand'

type WorkbenchSettingsState = {
  /** When true, data mutations (INSERT, UPDATE, DELETE) are allowed */
  allowEditOperations: boolean
  /** When true, DDL operations (ALTER TABLE, CREATE INDEX, etc.) are allowed */
  allowTableModify: boolean
  setAllowEditOperations: (value: boolean) => void
  setAllowTableModify: (value: boolean) => void
}

/**
 * Session-only settings store for the workbench.
 * These settings are not persisted and reset when the page is refreshed.
 */
export const useWorkbenchSettingsStore = create<WorkbenchSettingsState>((set) => ({
  allowEditOperations: true,
  allowTableModify: true,
  setAllowEditOperations: (value) => set({ allowEditOperations: value }),
  setAllowTableModify: (value) => set({ allowTableModify: value }),
}))
