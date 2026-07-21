export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface IssueRefreshTokenInput {
  userId: string;
  expiresAt: Date;
  createdByIp?: string;
  userAgent?: string;
}

export interface IssuedRefreshToken {
  id: string;
  /** Plaintext token — only ever available at issuance time; never stored. */
  rawToken: string;
}

/** Settings > Security > Active Sessions (2026-07-21) - the richer shape `listActiveByUser`
 * returns for display, as opposed to `RefreshTokenRecord`'s minimal shape used by the
 * login/refresh/reuse-detection validation paths above. */
export interface SessionRecord {
  id: string;
  createdAt: Date;
  createdByIp: string | null;
  userAgent: string | null;
}

/**
 * Milestone 6 plan §3: refresh tokens are opaque random strings, not JWTs.
 * The implementation is responsible for generating the raw token and
 * hashing it (HMAC-SHA256, keyed with JWT_REFRESH_SECRET) before
 * persisting — see infrastructure/PrismaRefreshTokenRepository.ts. This
 * port only ever deals in raw tokens from the caller's side; hashing
 * details are an infrastructure concern, not exposed here.
 */
export interface IRefreshTokenRepository {
  issue(input: IssueRefreshTokenInput): Promise<IssuedRefreshToken>;
  findByRawToken(rawToken: string): Promise<RefreshTokenRecord | null>;
  /** Settings > Security > Active Sessions (2026-07-21) - looked up by the *token's own row id*
   * (the JWT's `sid` claim / the URL param on the revoke endpoint), never the raw token itself -
   * this is what lets `RevokeSessionUseCase` verify ownership (`record.userId === requester`)
   * before revoking, without the caller ever presenting the raw secret. */
  findById(id: string): Promise<RefreshTokenRecord | null>;
  /** Active = not revoked AND not yet expired. Ordered newest-first. Each row is effectively one
   * logged-in device (see `SessionRecord`'s doc comment) - safe to show directly as "sessions". */
  listActiveByUser(userId: string): Promise<SessionRecord[]>;
  /**
   * Revoke a single token, with no replacement issued. Used by logout
   * (single-session) and by reuse-detection's "kill everything" response.
   * Audit finding C-01: MUST be implemented as a single atomic conditional
   * update (revoke only if not already revoked), not a read-then-write.
   * Returns true if THIS call is the one that revoked it; false if it was
   * already revoked (e.g. a concurrent caller won the race).
   */
  revoke(id: string): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<number>;
  /**
   * Production-readiness review finding (post-H-04): atomically revoke
   * `oldTokenId` (only if not already revoked) AND issue its replacement,
   * as a SINGLE transaction — not two independent calls. This is what
   * `RefreshTokenUseCase` uses for rotation instead of calling `revoke()`
   * then `issue()` separately.
   *
   * Two guarantees this provides that two separate calls cannot:
   *  1. Race-proof claim: only one of any number of concurrent callers
   *     targeting the same `oldTokenId` gets a non-null result (same
   *     atomicity guarantee `revoke()` alone provides, per C-01).
   *  2. Failure atomicity: if issuing the replacement fails for ANY reason
   *     after the old token was claimed, the whole transaction rolls back
   *     — the old token is NOT left revoked with no replacement. A
   *     legitimate user hitting a transient failure can simply retry with
   *     the same (still-valid) old token, instead of being permanently
   *     logged out by an unrelated infrastructure hiccup.
   *
   * Returns the new token if this call won the claim; null if `oldTokenId`
   * was already revoked (reuse/lost race) — callers should treat a null
   * result exactly like TokenReuseDetectedError.
   */
  rotate(oldTokenId: string, newToken: IssueRefreshTokenInput): Promise<IssuedRefreshToken | null>;
}
