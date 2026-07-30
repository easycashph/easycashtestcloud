import { createHmac, randomBytes } from 'node:crypto';
import { env } from '@shared/config/env';

/** Mirrors `PrismaRefreshTokenRepository.hashToken`'s own scheme (HMAC-SHA256 keyed with an
 * existing app secret) - deterministic for O(1) lookup by hash, and a DB leak alone can't forge a
 * matching value without also knowing `JWT_REFRESH_SECRET`. Reuses that secret rather than
 * introducing a new required env var for what is, functionally, the same kind of opaque bearer
 * token. */
export function hashSigningSecret(raw: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(raw).digest('hex');
}

/** The raw link token - 32 random bytes, returned to the caller exactly once at session creation
 * and never itself persisted (only its hash is). */
export function generateSigningToken(): string {
  return randomBytes(32).toString('hex');
}

/** 6-digit OTP, human-typeable. Uses `randomBytes` (not `Math.random`) since this gates access to
 * a legal document signing flow. */
export function generateOtpCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, '0');
}
