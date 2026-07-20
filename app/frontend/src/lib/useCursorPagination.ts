import * as React from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Stable fallback reference for `items` while `query.data` is undefined (loading, or between a
 * filter change and its first response) - `?? []` would otherwise create a brand-new array every
 * render, and any caller's `useEffect` keyed on that array (e.g. resetting a selection whenever the
 * page's data changes) would see a "changed" dependency on every single render and re-fire in a
 * tight loop until the query actually resolves - observed live as React's "Maximum update depth
 * exceeded" warning on the List of Loan Applications page (2026-07-20). */
const EMPTY_ITEMS: never[] = [];

/**
 * Real, cursor-driven Next/Previous pagination - replaces the earlier `fetchAllPages` "load
 * everything up front" pattern on list pages, which was the direct cause of frontend lag once a
 * list grew past a couple hundred rows (see `apiClient.ts`'s `fetchAllPages` doc comment, which
 * flagged this as the intended fix once it became a real problem).
 *
 * Cursor pagination has no cheap "page N" jump, so Previous is implemented by remembering every
 * cursor visited this session (`cursorStack[i]` = the cursor that produced page `i`) rather than
 * asking the server to go backwards. `extraParams` (e.g. `search`) resets back to page 1 when it
 * changes, since a cursor from the old filter/search is meaningless under a new one.
 */
export function useCursorPagination<T>(
  queryKeyBase: readonly unknown[],
  basePath: string,
  extraParams: Record<string, string | undefined> = {},
  pageSize = 100,
  enabled = true,
): {
  items: T[];
  query: UseQueryResult<CursorPage<T>>;
  pageNumber: number;
  hasNext: boolean;
  hasPrev: boolean;
  goNext: () => void;
  goPrev: () => void;
} {
  const [cursorStack, setCursorStack] = React.useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = React.useState(0);

  const paramsKey = JSON.stringify(extraParams);
  React.useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
  }, [paramsKey]);

  const cursor = cursorStack[pageIndex];

  const query = useQuery({
    queryKey: [...queryKeyBase, pageSize, cursor, extraParams],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (cursor) params.set('cursor', cursor);
      for (const [key, value] of Object.entries(extraParams)) {
        if (value) params.set(key, value);
      }
      const separator = basePath.includes('?') ? '&' : '?';
      return apiClient.get<CursorPage<T>>(`${basePath}${separator}${params.toString()}`);
    },
    enabled,
  });

  const goNext = () => {
    const next = query.data?.nextCursor;
    if (!next) return;
    setCursorStack((prev) => {
      const copy = [...prev];
      copy[pageIndex + 1] = next;
      return copy;
    });
    setPageIndex((i) => i + 1);
  };

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));

  return {
    items: query.data?.items ?? EMPTY_ITEMS,
    query,
    pageNumber: pageIndex + 1,
    hasNext: Boolean(query.data?.nextCursor),
    hasPrev: pageIndex > 0,
    goNext,
    goPrev,
  };
}
