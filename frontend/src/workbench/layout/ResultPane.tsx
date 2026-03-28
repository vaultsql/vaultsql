import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  PlusIcon,
  TableCellsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RoutineResourceIcon } from '../components/ResourceIcons'
import { TabErrorBoundary } from '../components/TabErrorBoundary'
import { NewTableTab } from '../tabs/NewTableTab'
import { RoutineTab } from '../tabs/RoutineTab'
import { TableTab } from '../tabs/TableTab'
import {
  type RoutineTabConfig,
  type TabDescriptor,
  useTabsStore,
  type WorkbenchTabType,
} from '../tabs/useTabsStore'
import { WorksheetTab } from '../tabs/WorksheetTab'

export function ResultPane() {
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)
  const selectTab = useTabsStore((state) => state.selectTab)
  const closeTab = useTabsStore((state) => state.closeTab)
  const pinTab = useTabsStore((state) => state.pinTab)

  return (
    <section className="flex h-full flex-col overflow-hidden bg-card">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={selectTab}
        onCloseTab={closeTab}
        onPinTab={pinTab}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {tabs.length === 0 ? (
          <EmptyState />
        ) : (
          // All tabs stay mounted, only active is visible
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${tab.id === activeTabId ? 'block' : 'hidden'}`}
            >
              <TabContent tab={tab} />
            </div>
          ))
        )}
      </div>
    </section>
  )
}

type TabBarProps = {
  tabs: TabDescriptor[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onPinTab: (tabId: string) => void
}

function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onPinTab }: TabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollContainerRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState)
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [updateScrollState, tabs.length])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current
    if (!el) return
    const scrollAmount = 200
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <nav
      className="relative flex shrink-0 items-end border-b border-border bg-background"
      aria-label="Open tabs"
    >
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          type="button"
          className="absolute left-0 z-10 flex h-8 w-6 items-center justify-center bg-background/90 hover:bg-muted"
          onClick={() => scroll('left')}
          aria-label="Scroll tabs left"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
      )}

      <div
        ref={scrollContainerRef}
        className="flex flex-1 items-end gap-0 overflow-x-auto px-2 pt-2 scrollbar-none"
      >
        {tabs.length === 0 ? (
          <div className="flex h-8 items-center px-4 font-mono text-xs text-muted-foreground">
            Open a table to start browsing data.
          </div>
        ) : (
          tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId
            const nextTab = tabs[index + 1]
            const nextIsActive = nextTab?.id === activeTabId
            const showSeparator = !isActive && !nextIsActive && index < tabs.length - 1

            return (
              <div
                key={tab.id}
                className={`group relative flex h-8 min-w-[80px] max-w-[160px] items-center gap-1.5 rounded-t-md px-2 font-mono text-xs transition-colors ${
                  isActive
                    ? 'border-t border-l border-r border-zinc-200/80 bg-zinc-100/70 text-foreground dark:border-zinc-700/60 dark:bg-zinc-800/60'
                    : 'border-t border-l border-r border-transparent bg-transparent text-muted-foreground hover:bg-card hover:text-foreground'
                } ${showSeparator ? 'border-r-border/40' : ''}`}
                role="tab"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    onCloseTab(tab.id)
                  }
                }}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-md wb-tab-active-indicator" />
                )}

                <TabIcon tab={tab} />

                <button
                  type="button"
                  className="flex-1 truncate text-left outline-none"
                  onClick={() => onSelectTab(tab.id)}
                  onDoubleClick={() => {
                    if (tab.isPreview) {
                      onPinTab(tab.id)
                    }
                  }}
                  title={tab.title}
                >
                  <span className={tab.isPreview ? 'italic' : ''}>{tab.title}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  className={`shrink-0 rounded p-0.5 hover:bg-muted-foreground/20 ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTab(tab.id)
                  }}
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          type="button"
          className="absolute right-0 z-10 flex h-8 w-6 items-center justify-center bg-background/90 hover:bg-muted"
          onClick={() => scroll('right')}
          aria-label="Scroll tabs right"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      )}
    </nav>
  )
}

function TabIcon({ tab }: { tab: TabDescriptor }) {
  if (tab.tabType === 'worksheet') {
    return <DocumentTextIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
  }
  if (tab.tabType === 'new-table') {
    return <PlusIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
  }
  if (tab.tabType === 'routine') {
    const config = tab.config as RoutineTabConfig
    return <RoutineResourceIcon objectType={config.objectType} className="h-3.5 w-3.5 shrink-0" />
  }
  return <TableCellsIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
}

function EmptyState() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Open a table from the sidebar to view its data here.
    </div>
  )
}

function TabContent({ tab }: { tab: TabDescriptor }) {
  let content: React.ReactNode

  switch (tab.tabType) {
    case 'worksheet':
      content = <WorksheetTab tab={tab} />
      break
    case 'new-table':
      content = <NewTableTab tab={tab} />
      break
    case 'routine':
      content = <RoutineTab tab={tab} />
      break
    default:
      content = <TableTab tab={tab} />
  }

  return (
    <TabErrorBoundary tabId={tab.id} tabTitle={tab.title}>
      {content}
    </TabErrorBoundary>
  )
}
