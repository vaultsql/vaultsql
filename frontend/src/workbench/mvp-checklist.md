# VaultSQL Workbench - MVP Checklist

**Goal**: Build a functional SQL workbench with essential features for querying and browsing databases.

**Status Legend**: ❌ Not Started | 🟡 In Progress | ✅ Complete

---

## Phase 1: Core Infrastructure

### Basic Layout & Routing
- [ ] Set up dockable layout system (rc-dock or react-mosaic)
- [ ] Create WorkbenchContext with basic types
- [ ] Implement top bar with connection info display
- [ ] Implement collapsible left sidebar
- [ ] Implement collapsible bottom panel
- [ ] Tab system for main workspace (open/close/switch tabs)

### Connection & Context
- [ ] Display database name and type in top bar
- [ ] Display current schema
- [ ] Show READ-ONLY vs READ-WRITE mode indicator
- [ ] Inject query execution function via context

---

## Phase 2: Query Editor (Priority 1)

### Basic Query Editor
- [x] Integrate CodeMirror editor in a tab
- [ ] SQL syntax highlighting
- [ ] Line numbers and basic editing features
- [ ] Run single query button (▶️)
- [ ] Run all queries button (▶️▶️)
- [ ] Show execution in progress indicator

### Query Execution
- [ ] Execute query via context API
- [ ] Handle query response (success)
- [ ] Handle query errors
- [ ] Display execution time
- [ ] Display row count

### Keyboard Shortcuts
- [ ] Cmd/Ctrl+Enter to run query
- [ ] Cmd/Ctrl+Shift+Enter to run all
- [ ] Cmd/Ctrl+T for new query tab
- [ ] Cmd/Ctrl+W to close tab
- [ ] Cmd/Ctrl+S to save (if worksheet)

---

## Phase 3: Results Display (Priority 1)

### Results Grid
- [ ] Integrate MUI DataGrid for results
- [ ] Display columns from query result
- [ ] Display rows from query result
- [ ] Show "X rows returned" in footer
- [ ] Handle empty results (0 rows)
- [ ] Handle INSERT/UPDATE/DELETE results (rows affected)

### Results Actions
- [ ] Copy selected cells
- [ ] Export results to CSV
- [ ] Export results to JSON
- [ ] Column sorting (click header)
- [ ] Column resizing (drag border)

### Error Display
- [ ] Show error message in results panel
- [ ] Display SQL error details (code, line, hint)
- [ ] Copy error button
- [ ] Highlight error line in editor (if line number provided)

---

## Phase 4: Database Explorer (Priority 2)

### Objects Tree - Basic
- [ ] Display "Objects" tab in sidebar
- [ ] Connect to database metadata API
- [ ] Display list of tables in tree
- [ ] Display table count badge
- [ ] Expandable/collapsible tree nodes
- [ ] Search/filter tables by name

### Table Interactions
- [ ] Double-click table to open in new tab
- [ ] Right-click context menu on table
- [ ] "Browse Data" option → opens table browser
- [ ] "Copy Table Name" option
- [ ] "Open in New Tab" option

### Schema Support
- [ ] Schema switcher dropdown (if multi-schema DB)
- [ ] Filter tables by selected schema
- [ ] Display current schema in top bar

---

## Phase 5: Table Browser (Priority 2)

### Browse Table Data
- [ ] Open table in browsing tab
- [ ] Load table data (with row limit)
- [ ] Display data in grid
- [ ] Show table name in tab
- [ ] Refresh button to reload data
- [ ] Pagination controls (if many rows)

### Table Filtering
- [ ] Add filter button
- [ ] Single filter: [Column] [Operator] [Value]
- [ ] Apply filter to reload data
- [ ] Remove filter
- [ ] Multiple filters with AND logic

### Filter Operators
- [ ] Equals (=)
- [ ] Not equals (!=)
- [ ] Greater than (>)
- [ ] Less than (<)
- [ ] LIKE
- [ ] IS NULL
- [ ] IS NOT NULL

### Table Data Actions
- [ ] Sort by column (ascending/descending)
- [ ] Copy cell value
- [ ] Search across all columns
- [ ] Show/hide columns
- [ ] Export table data to CSV

---

## Phase 6: Query Log (Priority 2)

### Basic Query Log
- [ ] "Query Log" tab in bottom panel
- [ ] Display list of executed queries
- [ ] Show timestamp for each query
- [ ] Show execution time
- [ ] Show status (success/error)
- [ ] Show row count or affected rows

### Log Interactions
- [ ] Click to expand/view full query
- [ ] Copy query from log
- [ ] Re-run query from log
- [ ] Open query in new editor tab
- [ ] Clear log button

### Log Filtering
- [ ] Show all queries
- [ ] Filter: success only
- [ ] Filter: errors only

---

## Phase 7: Worksheets (Priority 3)

### Worksheet Management
- [ ] "Worksheets" tab in sidebar
- [ ] Display list of worksheets from sources
- [ ] Load worksheet tree from context
- [ ] Click worksheet to open in tab
- [ ] Show worksheet name in tab title

### Worksheet CRUD
- [ ] Create new worksheet (+ button)
- [ ] Open existing worksheet
- [ ] Edit worksheet content
- [ ] Save worksheet (Cmd/Ctrl+S)
- [ ] Show unsaved indicator (• dot)
- [ ] Delete worksheet (with confirmation)
- [ ] Rename worksheet

### Worksheet Sources
- [ ] Display multiple sources (Local, Cloud, etc.)
- [ ] Expandable source nodes
- [ ] Source icons (💻 Local, ☁️ Cloud)

---

## Phase 8: Console & Messages (Priority 3)

### Console Tab
- [ ] "Console" tab in bottom panel
- [ ] Display info messages
- [ ] Display warning messages
- [ ] Display error messages
- [ ] Timestamp for each message
- [ ] Clear console button

### Message Types
- [ ] Info (blue icon)
- [ ] Warning (amber icon)
- [ ] Error (red icon)
- [ ] Success (green icon)

---

## Phase 9: Table Structure (Priority 4)

### View Table Structure
- [ ] "View Structure" context menu option
- [ ] Open structure tab for table
- [ ] Display columns list (name, type, nullable, default)
- [ ] Display primary key indicator
- [ ] Display foreign key indicator

### Structure Information
- [ ] Show indexes
- [ ] Show constraints
- [ ] Show DDL (CREATE TABLE statement)
- [ ] Copy DDL button

---

## Phase 10: Additional Features (Priority 4)

### Column Metadata
- [ ] "Columns" tab in bottom panel
- [ ] Show column details for current result set
- [ ] Display: name, type, nullable, max length

### Ad-hoc Queries
- [ ] "+" button in tab bar to create new query
- [ ] Label as "Untitled Query"
- [ ] Allow multiple untitled queries
- [ ] Prompt to save on close if modified

### UI Improvements
- [ ] Loading states for queries
- [ ] Loading states for tree nodes
- [ ] Toast notifications for actions
- [ ] Confirmation dialogs for destructive actions

---

## Phase 11: READ-WRITE Mode (Priority 5)

### Enable Editing (if mode = READ-WRITE)
- [ ] Check mode from context
- [ ] Enable cell editing in table browser
- [ ] Double-click cell to edit
- [ ] Tab to next cell
- [ ] Save changes button
- [ ] Discard changes button

### Dangerous Actions
- [ ] Show confirmation for DELETE operations
- [ ] Show confirmation for DROP operations
- [ ] Add row in table browser
- [ ] Delete selected rows
- [ ] Drop table option (with confirmation)

### Transaction Controls
- [ ] BEGIN transaction button
- [ ] COMMIT button
- [ ] ROLLBACK button
- [ ] Show transaction state indicator

---

## Phase 12: Polish & UX (Priority 5)

### Visual Polish
- [ ] Proper spacing and alignment
- [ ] Consistent iconography
- [ ] Loading spinners
- [ ] Empty states (no results, no worksheets, etc.)
- [ ] Error boundaries

### Responsive Behavior
- [ ] Panel resize handles work smoothly
- [ ] Minimum panel sizes respected
- [ ] Collapsible panels remember state

### Keyboard Navigation
- [ ] Tab through interactive elements
- [ ] Arrow keys in tree navigation
- [ ] Escape to close dialogs/cancel operations

### Accessibility Basics
- [ ] ARIA labels on buttons
- [ ] Focus indicators visible
- [ ] Semantic HTML structure

---

## Nice-to-Have (Post-MVP)

### Query Editor Enhancements
- [ ] SQL auto-completion (tables, columns, keywords)
- [ ] Format SQL button
- [ ] Multiple statements with separate result tabs
- [ ] Query limit dropdown (100, 1000, etc.)

### Data Grid Enhancements
- [ ] Virtualized scrolling for large datasets
- [ ] Pin columns (left/right)
- [ ] Reorder columns (drag header)
- [ ] Copy row as JSON
- [ ] Copy row as INSERT statement

### Table Browser Enhancements
- [ ] OR logic for filters
- [ ] Saved filter presets
- [ ] Column statistics/profiling
- [ ] Bulk edit multiple rows

### Sidebar Enhancements
- [ ] Recent objects list
- [ ] Favorite/star tables
- [ ] Quick actions on hover (browse, query, copy)
- [ ] View functions, sequences, types

### Query Log Enhancements
- [ ] Persist log across sessions
- [ ] Export log to file
- [ ] Search/filter log entries
- [ ] Group by tab/worksheet

### Worksheet Enhancements
- [ ] Folder organization
- [ ] Duplicate worksheet
- [ ] Add to favorites
- [ ] Drag-and-drop reorder

### Settings
- [ ] Theme switcher (light/dark)
- [ ] Font size adjustment
- [ ] Result row limit preference
- [ ] Auto-save preference

---

## Testing Milestones

### Manual Testing Scenarios
- [ ] Connect and run simple SELECT query
- [ ] Browse table with 1000+ rows
- [ ] Apply filters to table browser
- [ ] Create and save a worksheet
- [ ] Open multiple tabs and switch between them
- [ ] Execute query with syntax error
- [ ] Execute multi-statement query
- [ ] Test READ-ONLY mode (editing disabled)
- [ ] Test READ-WRITE mode (editing enabled)
- [ ] Export results to CSV and JSON

---

## Notes

- Focus on getting basic query execution working first
- Table browsing is second priority
- Worksheets can come after core features work
- READ-WRITE mode is lower priority (most users in READ-ONLY)
- Polish and accessibility can be iterative improvements

**Next Step**: Start with Phase 1 (Core Infrastructure) and Phase 2 (Query Editor).
