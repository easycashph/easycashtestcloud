import type { Request } from 'express';

/**
 * Milestone 8 / D-4 (approved, reduced scope): cursor pagination only —
 * limit + nextCursor. Deliberately no search, filtering, or sorting
 * parameters here; those are out of scope for this milestone.
 */
export interface PaginationParams {
  limit: number;
  cursor?: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Parses `?limit=&cursor=` from an Express request, applying the same default/cap already established by ListLoanTransactionsForAccountUseCase (Milestone 7). */
export function parsePaginationParams(query: Request['query']): PaginationParams {
  const rawLimit = query.limit;
  const parsedLimit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : NaN;
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  const rawCursor = query.cursor;
  const cursor = typeof rawCursor === 'string' && rawCursor.length > 0 ? rawCursor : undefined;

  return { limit, cursor };
}

/** Parses an optional `?search=` free-text query param, trimmed, empty string treated as absent. */
export function parseSearchParam(query: Request['query']): string | undefined {
  const raw = query.search;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Builds the consistent `{ items, nextCursor }` envelope for every list
 * endpoint. `nextCursor` is set only when a full page was returned (a
 * short page means there's nothing more to fetch) — the same heuristic
 * already used informally by the ledger module's pagination.
 */
export function toPaginatedResponse<T>(items: T[], limit: number, getCursor: (item: T) => string): PaginatedResponse<T> {
  const nextCursor = items.length === limit ? getCursor(items[items.length - 1]!) : null;
  return { items, nextCursor };
}
