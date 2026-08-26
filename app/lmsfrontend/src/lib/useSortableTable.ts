import * as React from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string | null;
  direction: SortDirection;
}

/**
 * Generic client-side column sort, used across the app's tables. Deliberately client-side, not a
 * server-side sort - it sorts whatever already-fetched/already-filtered array the page passes in.
 *
 * Date columns (per the standing requirement: any Date column always
 * starts sorted recent-to-oldest) should pass `isDateColumn: true` the
 * first time that column is clicked, AND should be given as `initial` so
 * the table opens already sorted that way, not only after a click.
 */
/** Just the `{ sort, toggleSort }` half of `useSortableTable`, split out so a page can read the
 * current sort BEFORE it has its rows in hand - e.g. to feed a column's direction into a
 * server-side query param (see `ClientListPage.tsx`'s "Date Created" column, sorted server-side
 * across every page rather than per-page like every other column here). */
export function useSortState(initial: SortState) {
  const [sort, setSort] = React.useState<SortState>(initial);

  const toggleSort = React.useCallback((key: string, isDateColumn = false) => {
    setSort((prev) => {
      if (prev.key !== key) {
        // Newly-clicked column: dates default to recent-to-oldest (desc);
        // every other column defaults to ascending.
        return { key, direction: isDateColumn ? 'desc' : 'asc' };
      }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  return { sort, toggleSort };
}

/** The `rows`-dependent half of `useSortableTable` - given rows and an already-known sort state,
 * returns the reordered array. Exported separately for the same reason as `useSortState` above. */
export function sortRows<T>(rows: T[], getValue: (row: T, key: string) => string | number | Date | null | undefined, sort: SortState): T[] {
  if (!sort.key) return rows;
  const key = sort.key;
  const withIndex = rows.map((row, index) => ({ row, index }));
  withIndex.sort((a, b) => {
    const av = getValue(a.row, key);
    const bv = getValue(b.row, key);
    const cmp = compareValues(av, bv);
    // Stable sort: fall back to original order on a tie, since
    // Array.prototype.sort's stability guarantee alone doesn't help
    // once we've boxed rows with their index (defensive, not strictly
    // needed on modern JS engines, but explicit is cheap here).
    if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
    return a.index - b.index;
  });
  return withIndex.map((entry) => entry.row);
}

export function useSortableTable<T>(rows: T[], getValue: (row: T, key: string) => string | number | Date | null | undefined, initial: SortState) {
  const { sort, toggleSort } = useSortState(initial);
  const sorted = React.useMemo(() => sortRows(rows, getValue, sort), [rows, sort, getValue]);
  return { sorted, sort, toggleSort };
}

function compareValues(a: string | number | Date | null | undefined, b: string | number | Date | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : new Date(a as string).getTime();
    const bt = b instanceof Date ? b.getTime() : new Date(b as string).getTime();
    return at - bt;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
