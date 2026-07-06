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
 */
export interface StoredIdempotentResponse {
  statusCode: number;
  responseBody: unknown;
}

export interface IIdempotencyKeyStore {
  /**
   * Looks up a prior response recorded for this exact (key, endpoint) pair.
   * `endpoint` scopes the key namespace (e.g. `"POST /loan-accounts/:id/activate"`)
   * so the same client-chosen key value used against two different
   * endpoints is never treated as a collision.
   */
  find(key: string, endpoint: string): Promise<StoredIdempotentResponse | null>;

  /**
   * Records a response for this (key, endpoint) pair. Callers must only
   * call this once a real, successful response is ready to store — never
   * for an error response, so a transient failure can still be retried
   * with the same key.
   */
  save(key: string, endpoint: string, userId: string, response: StoredIdempotentResponse): Promise<void>;
}
