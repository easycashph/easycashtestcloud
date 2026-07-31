export interface TrustedDeviceRecord {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface IssueTrustedDeviceInput {
  userId: string;
  expiresAt: Date;
}

export interface IssuedTrustedDevice {
  id: string;
  /** Plaintext token - only ever available at issuance time; never stored (same posture as
   * IRefreshTokenRepository.rawToken). The caller returns this to the client once, for it to store
   * and resend on future logins. */
  rawToken: string;
}

/**
 * "Remember this device" (2026-07-30 user request) - same opaque-token-never-stored-in-plaintext
 * shape as IRefreshTokenRepository, deliberately simpler (no rotation - a device token is presented
 * read-only on login, never refreshed/replaced mid-session).
 */
export interface ITrustedDeviceRepository {
  issue(input: IssueTrustedDeviceInput): Promise<IssuedTrustedDevice>;
  /** Looked up by the raw token itself (hashed internally before the lookup) - returns null for an
   * unknown, expired, or tampered token alike, never distinguishing which to the caller. */
  findValidByRawToken(rawToken: string): Promise<TrustedDeviceRecord | null>;
}
