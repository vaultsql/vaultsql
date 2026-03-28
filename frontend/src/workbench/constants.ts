/**
 * Workbench-wide constants for consistent behavior across components.
 */

// --- Detail Value Renderer ---

/**
 * Maximum characters to display before truncating text values.
 * User can expand to see more, up to DETAIL_VALUE_MAX_LENGTH.
 */
export const DETAIL_VALUE_TRUNCATE_LENGTH = 300

/**
 * Maximum number of lines to display before truncating text values.
 * Applies to both collapsed and expanded states.
 */
export const DETAIL_VALUE_MAX_LINES = 20

/**
 * Hard maximum characters for any value display, even when expanded.
 * This prevents performance issues with extremely large values.
 */
export const DETAIL_VALUE_MAX_LENGTH = 2000

/**
 * Maximum number of array items to display before truncating.
 */
export const DETAIL_VALUE_MAX_ARRAY_ITEMS = 50

/**
 * Maximum depth for JSON pretty-printing before falling back to compact format.
 */
export const DETAIL_VALUE_JSON_MAX_DEPTH = 5
