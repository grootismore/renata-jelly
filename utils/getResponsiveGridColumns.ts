/**
 * Shared column-count formula for Renata's browse grids (Library, Favorites
 * "See all"). Targets a constant card width — matching the ~112px (`w-28`)
 * poster convention already used across Home/Search rows — instead of a
 * fixed set of per-device breakpoints, so the grid naturally gains columns
 * on wider screens (iPad) rather than just growing iPhone-sized cards
 * (Phase 4 §4/§14).
 *
 * Both call sites previously hand-rolled their own breakpoint ladder
 * ([libraryId].tsx: 2/3/5/6/7/6 — note the drop from 7 to 6 above 1500pt,
 * likely an oversight; favorites/see-all.tsx: 2/3/5/6). This replaces both
 * with one formula so Library and Favorites grids size identically.
 */
const GRID_ITEM_TARGET_WIDTH = 110;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 10;

export const getResponsiveGridColumns = (screenWidth: number): number => {
  const columns = Math.round(screenWidth / GRID_ITEM_TARGET_WIDTH);
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, columns));
};
