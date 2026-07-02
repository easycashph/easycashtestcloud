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
}

export interface IssuedRefreshToken {
  id: string;
  /** Plaintext token — only ever available at issuance time; never stored. */
  rawToken: string;
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
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<number>;
}
