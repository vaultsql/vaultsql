import { create } from 'zustand'
import type { FilterInput } from '@/workbench/types/database'

export type WorkbenchTabType = 'browse-data' | 'table-edit' | 'worksheet' | 'new-table' | 'routine'

// Typed config for table tabs
export type TableTabConfig = {
  schema: string
  table: string
  isView?: boolean
  filters?: FilterInput[]
  filterMode?: 'all' | 'any'
}

// Typed config for worksheet tabs
export type WorksheetTabConfig = {
  worksheetId?: string // undefined = draft mode
  initialContent?: string // Used for drafts to set initial SQL content
}

// Typed config for new table tabs
export type NewTableTabConfig = {
  schema: string
}

// Typed config for routine tabs
export type RoutineTabConfig = {
  schema: string
  objectName: string
  objectType: 'function' | 'procedure'
}

/**
 * TabDescriptor is the identity of a tab - what it is, not its runtime state.
 * Each tab component owns its own runtime state (result, status, error) locally.
 */
export type TabDescriptor = {
  id: string
  title: string
  tabType: WorkbenchTabType
  isPreview?: boolean // Preview tabs get replaced when opening another preview
  config:
    | TableTabConfig
    | WorksheetTabConfig
    | NewTableTabConfig
    | RoutineTabConfig
    | Record<string, string>
}

type TabsStoreState = {
  tabs: TabDescriptor[]
  activeTabId: string | null
}

type TabsStoreActions = {
  addTab: (tab: TabDescriptor) => void
  addPreviewTab: (tab: TabDescriptor) => void
  pinTab: (tabId: string) => void
  selectTab: (tabId: string | null) => void
  closeTab: (tabId: string) => void
  updateTab: (tabId: string, updates: Partial<Pick<TabDescriptor, 'title' | 'config'>>) => void
  resetTabFilters: (tabId: string, filters: FilterInput[]) => void
  updateTabFilterMode: (tabId: string, filterMode: 'all' | 'any') => void
}

export type TabsStore = TabsStoreState & TabsStoreActions

export const useTabsStore = create<TabsStore>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((state) => {
      const existingIndex = state.tabs.findIndex(({ id }) => id === tab.id)
      if (existingIndex >= 0) {
        // Tab already exists, just select it
        return { activeTabId: tab.id }
      }

      return {
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      }
    }),

  addPreviewTab: (tab) =>
    set((state) => {
      const existingIndex = state.tabs.findIndex(({ id }) => id === tab.id)
      if (existingIndex >= 0) {
        // Tab already exists, just select it (and keep its preview status)
        return { activeTabId: tab.id }
      }

      // Find existing preview tab and replace it
      const existingPreviewIndex = state.tabs.findIndex((t) => t.isPreview)

      if (existingPreviewIndex >= 0) {
        // Replace the existing preview tab
        const nextTabs = [...state.tabs]
        nextTabs[existingPreviewIndex] = { ...tab, isPreview: true }

        return {
          tabs: nextTabs,
          activeTabId: tab.id,
        }
      }

      // No existing preview, add as new preview tab
      return {
        tabs: [...state.tabs, { ...tab, isPreview: true }],
        activeTabId: tab.id,
      }
    }),

  pinTab: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, isPreview: false } : tab)),
    })),

  selectTab: (tabId) =>
    set({
      activeTabId: tabId,
    }),

  closeTab: (tabId) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === tabId)
      if (index === -1) {
        return state
      }

      const nextTabs = state.tabs.filter((tab) => tab.id !== tabId)
      let nextActive = state.activeTabId

      if (state.activeTabId === tabId) {
        if (nextTabs.length === 0) {
          nextActive = null
        } else {
          const nextIndex = Math.min(index, nextTabs.length - 1)
          nextActive = nextTabs[nextIndex]?.id ?? null
        }
      }

      return {
        tabs: nextTabs,
        activeTabId: nextActive,
      }
    }),

  updateTab: (tabId, updates) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)),
    })),

  resetTabFilters: (tabId, filters) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              config: { ...tab.config, filters } as
                | TableTabConfig
                | WorksheetTabConfig
                | NewTableTabConfig
                | RoutineTabConfig
                | Record<string, string>,
            }
          : tab,
      ),
      activeTabId: tabId,
    })),

  updateTabFilterMode: (tabId, filterMode) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              config: { ...tab.config, filterMode } as
                | TableTabConfig
                | WorksheetTabConfig
                | NewTableTabConfig
                | RoutineTabConfig
                | Record<string, string>,
            }
          : tab,
      ),
    })),
}))
