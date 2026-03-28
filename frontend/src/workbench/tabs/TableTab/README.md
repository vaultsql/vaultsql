# TableTab

Table browsing and editing functionality for the workbench.

## Structure

```
TableTab/
├── TableTab.tsx                      # Main component
├── components/
│   ├── panes/                        # Full-page views
│   ├── toolbars/                     # Toolbar components
│   ├── grid/                         # Data grid components
│   └── dialogs/                      # Modal dialogs
├── state/                            # State management
└── hooks/                            # Custom hooks
```

## Usage

```tsx
import { TableTab } from '@/workbench/tabs/TableTab'

const tab: TabDescriptor = {
  id: 'table-users',
  title: 'users',
  tabType: 'table-edit',
  config: {
    schema: 'public',
    table: 'users',
    filters: []
  }
}

<TableTab tab={tab} />
```
