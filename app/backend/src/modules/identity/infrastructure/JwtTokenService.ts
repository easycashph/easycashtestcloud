import jwt from 'jsonwebtoken';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import type { AccessTokenClaims, ITokenService, SignedAccessToken } from '../application/ports/ITokenService';

/** Milestone 6 plan §3: HS256, single monolith verifies its own tokens. */
export class JwtTokenService implements ITokenService {
  signAccessToken(claims: AccessTokenClaims): SignedAccessToken {
    const signOptions: jwt.SignOptions = {
      algorithm: 'HS256',
      // env.JWT_ACCESS_TTL is validated as a non-empty string by
      // shared/config/env.ts (e.g. "15m") but Zod can't express the
      // `jsonwebtoken` library's branded `StringValue` duration type, so a
      // narrow cast is needed here at the one place the two meet.
      expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    };
    const token = jwt.sign(claims, env.JWT_ACCESS_SECRET, signOptions);

    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now());

    return { token, expiresAt };
  }

  verifyAccessToken(token: string): AccessTokenClaims | null {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
      if (typeof payload !== 'object' || payload === null) {
        return null;
      }
      const { sub, email, roles, branchId, jti } = payload as Record<string, unknown>;
      if (
        typeof sub !== 'string' ||
        typeof email !== 'string' ||
        typeof branchId !== 'string' ||
        typeof jti !== 'string' ||
        !Array.isArray(roles)
      ) {
        return null;
      }
      return { sub, email, branchId, jti, roles: roles as string[] };
    } catch (error) {
      // Expired, malformed, or tampered signature — all treated as "not
      // authenticated," not a server error. Logged at debug level only
      // (this is routine/expected, not an incident).
      logger.debug({ err: error }, 'Access token verification failed');
      return null;
    }
  }
}
