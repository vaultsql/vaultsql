/**
 * CSS class names for data grids.
 * Styles are defined in @/components/index.css using @apply.
 * Both DataGrid and TableDataGrid use these to ensure visual consistency.
 */

/** Outer container for the grid */
export const GRID_CONTAINER_CLASS = 'grid-container'

/** The <table> element */
export const TABLE_CLASS = 'grid-table'

/** The <thead> element with sticky positioning */
export const THEAD_CLASS = 'grid-thead'

/** The row number / checkbox column header */
export const ROW_NUMBER_HEADER_CLASS = 'grid-row-number-header'

/** Regular column header cells - relative positioning for resize handle */
export const HEADER_CELL_CLASS = 'grid-header-cell'

/** Header cell when being dragged */
export const HEADER_CELL_DRAGGING_CLASS = 'grid-header-cell-dragging'

/**
 * Resize handle positioned at the right edge of header cell.
 * - Large hit area (12px) for easy targeting
 * - Visible indicator line on hover
 * - Uses absolute positioning at the column border
 * - touch-action:none prevents scroll interference on touch devices
 */
export const RESIZE_HANDLE_CLASS = 'grid-resize-handle'

/** Visual indicator inside the resize handle - visible on hover */
export const RESIZE_HANDLE_INDICATOR_CLASS = 'grid-resize-handle-indicator'

/** Resize handle in active/resizing state */
export const RESIZE_HANDLE_ACTIVE_CLASS = 'grid-resize-handle-active'

/** Visual indicator when actively resizing */
export const RESIZE_HANDLE_INDICATOR_ACTIVE_CLASS = 'grid-resize-handle-indicator-active'

/** The <tbody> element */
export const TBODY_CLASS = 'grid-tbody'

/** The row number / checkbox cell in tbody */
export const ROW_NUMBER_CELL_CLASS = 'grid-row-number-cell'

/** Regular data cells */
export const DATA_CELL_CLASS = 'grid-data-cell'

/** Default row styling */
export const ROW_DEFAULT_CLASS = 'grid-row-default'
