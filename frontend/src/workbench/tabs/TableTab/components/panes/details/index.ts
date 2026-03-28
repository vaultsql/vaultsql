/**
 * Details pane components and utilities.
 *
 * This module provides components for displaying row details in the table tab,
 * including value formatting, foreign key expansion, and editing capabilities.
 */

export { DetailsTable } from './DetailsTable'
export { type FkExpandState, FkWell } from './FkWell'
export {
  type FormattedValue,
  formatKeyDisplay,
  formatSimpleKeyDisplay,
  formatValue,
} from './formatters'
export { CopyableValue, ForeignKeyCell } from './ValueDisplay'
