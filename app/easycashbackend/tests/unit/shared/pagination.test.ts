import { describe, expect, it } from 'vitest';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';

describe('parsePaginationParams (Milestone 8 / D-4: cursor + limit only, no search/filter/sort)', () => {
  it('defaults to limit=50 with no cursor when the query is empty', () => {
    expect(parsePaginationParams({})).toEqual({ limit: 50, cursor: undefined });
  });

  it('parses a valid limit and cursor from query strings', () => {
    expect(parsePaginationParams({ limit: '20', cursor: 'abc-123' })).toEqual({ limit: 20, cursor: 'abc-123' });
  });

  it('caps an excessive limit at 200', () => {
    expect(parsePaginationParams({ limit: '100000' }).limit).toBe(200);
  });

  it('falls back to the default for a non-numeric, zero, or negative limit', () => {
    expect(parsePaginationParams({ limit: 'not-a-number' }).limit).toBe(50);
    expect(parsePaginationParams({ limit: '0' }).limit).toBe(50);
    expect(parsePaginationParams({ limit: '-5' }).limit).toBe(50);
  });

  it('ignores a non-string or empty cursor', () => {
    expect(parsePaginationParams({ cursor: '' }).cursor).toBeUndefined();
    expect(parsePaginationParams({ cursor: ['a', 'b'] as unknown as string }).cursor).toBeUndefined();
  });
});

describe('toPaginatedResponse', () => {
  it('sets nextCursor when a full page is returned', () => {
    const result = toPaginatedResponse(['a', 'b', 'c'], 3, (item) => `cursor-${item}`);
    expect(result).toEqual({ items: ['a', 'b', 'c'], nextCursor: 'cursor-c' });
  });

  it('sets nextCursor to null when fewer than a full page is returned (last page)', () => {
    const result = toPaginatedResponse(['a'], 3, (item) => `cursor-${item}`);
    expect(result).toEqual({ items: ['a'], nextCursor: null });
  });

  it('sets nextCursor to null for an empty page', () => {
    const result = toPaginatedResponse<string>([], 3, (item) => `cursor-${item}`);
    expect(result).toEqual({ items: [], nextCursor: null });
  });
});
