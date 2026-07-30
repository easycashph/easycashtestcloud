/**
 * Milestone 9.1/9.2 CP13
 * (`docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`, Decision Log
 * #9): a small, purpose-built lookup for client-supplied idempotency keys —
 * deliberately separate from `IFinancialAuditLogger` (that port records
 * history and must fail closed; this one is looked up, not just written, on
 * every request that carries an `Idempotency-Key` header, and a lookup
 * failure should not itself block a request the same way an audit-write
 * failure must).
 *
 * Placed in `shared/application/ports/`, not inside any one module — usable
 * by any future module's balance-mutating endpoint that needs duplicate-
 * resubmission protection, mirroring why `IFinancialAuditLogger`/
 * `IUnitOfWork` live here rather than in a single module.
 *
 * 2026-07-08 (H-4 fix): `find`/`save` replaced with `claim`/`complete`/
 * `release`. The old shape checked for a duplicate and stored the response
 * only after the use case had already run — the uniqueness constraint never
 * had a chance to block a second concurrent request before it reached the
 * use case layer, so two requests carrying the same key could both execute
 * a balance-mutating action in full. `claim()` now inserts the row (with no
 * response yet) *before* the use case runs, so a genuinely concurrent
 * duplicate collides with the DB unique constraint immediately.
 */
export interface StoredIdempotentResponse {
  statusCode: number;
  responseBody: unknown;
}

export type IdempotencyClaim =
  /** No prior row for this (key, endpoint) pair — caller may proceed to run the use case. */
  | { outcome: 'CLAIMED' }
  /** A prior request already ran this (key, endpoint) pair to completion — replay its response. */
  | { outcome: 'COMPLETED'; response: StoredIdempotentResponse }
  /** A prior request claimed this (key, endpoint) pair and hasn't finished yet — do not proceed. */
  | { outcome: 'IN_PROGRESS' };

export interface IIdempotencyKeyStore {
  /**
   * Atomically claims (key, endpoint) for this request, or reports why it
   * couldn't: `COMPLETED` (replay the stored response) or `IN_PROGRESS`
   * (another request is currently executing the same key/endpoint pair).
   */
  claim(key: string, endpoint: string, userId: string): Promise<IdempotencyClaim>;

  /**
   * Records the successful response for a (key, endpoint) pair this caller
   * previously claimed. Must only be called after a real, successful
   * response is ready — never for an error response.
   */
  complete(key: string, endpoint: string, response: StoredIdempotentResponse): Promise<void>;

  /**
   * Releases a claim this caller made but did not complete (its use case
   * threw), so a retry with the same key can claim it again. Never removes
   * an already-`complete()`d row.
   */
  release(key: string, endpoint: string): Promise<void>;
}
