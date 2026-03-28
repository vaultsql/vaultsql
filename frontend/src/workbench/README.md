# VaultSQL Workbench

## Overview

VaultSQL is a GUI SQL Client supporting different databases but uses HTTPS so access control is configured through a virtual interface instead of at the database level.

The WorkBench component is completely isolated and all functionality is injected via a context.

## Architecture

### Context-Driven Design

Everything is injected via `WorkbenchContext`:

```tsx
<DevWorkbenchContext>
    <Workbench />
</DevWorkbenchContext>
```

**Context provides:**
- Database name and type (currently PostgreSQL supported)
- Query execution function (returns columns, rows, status, errors - see `openapi.d.ts`)
- Worksheet sources (cloud/local/etc) and CRUD operations
- Mode: READ-ONLY or READ-WRITE
- Schema switching capability
- All functions are async-friendly

### Development Setup

- API endpoint: `http://localhost:8000/api/query/run` (POST - see `openapi.d.ts`)
- Worksheet store: in-memory during development
- All state changes through context (no direct DB access from UI)

## Tech Stack

- **Docking**: React dockable library (rc-dock or react-mosaic) for TablePlus-style layout
- **Data Grid**: MUI DataGrid for query results and table browsing
- **Code Editor**: CodeMirror for SQL editing with syntax highlighting
- **State**: Context API for all data/operations

## Layout Structure

Four main regions:
1. **Top Bar**: Connection info, schema selector, mode indicator
2. **Left Sidebar**: Database objects tree + worksheets tree (tabbed)
3. **Main Workspace**: Tabbed interface for query editors and table browsers
4. **Bottom Panel**: Results grid, query log, console, column metadata (tabbed)

## V1 Features

### Core Functionality
- Run queries in READ-ONLY and READ-WRITE modes
- Execute single query or all queries in editor
- Tabbed UI: query editor, table browser, table structure
- Query results in data grid with column info
- Friendly error display with SQL details

### Database Explorer
- List tables (with schema switching)
- Browse table data with pagination
- Filter table data (column-operator-value)
- View table structure (columns, indexes, constraints)
- Basic table management: drop, create, alter (READ-WRITE only)

### Worksheets
- List worksheets from multiple sources in single tree
- Create/edit/save/delete worksheets
- Open worksheets in editor tabs
- Ad-hoc queries (unnamed editor tabs)

### Query Management
- Query log (all executed queries with status and timing)
- Copy/re-run queries from log
- Console for messages and warnings
- Column metadata panel for result sets

## Documentation

- **UI Spec**: See `workbench-ui-spec.md` for detailed component specifications
- **MVP Checklist**: See `mvp-checklist.md` for implementation phases and progress tracking

## Development Priority

1. **Phase 1-2**: Core layout + query editor with execution
2. **Phase 3**: Results display and error handling
3. **Phase 4-5**: Database explorer and table browser
4. **Phase 6+**: Query log, worksheets, polish

Start with getting queries to run and show results, then build out browsing features.


