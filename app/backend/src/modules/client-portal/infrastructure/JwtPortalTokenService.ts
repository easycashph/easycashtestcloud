import jwt from 'jsonwebtoken';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import type { IPortalTokenService, PortalAccessTokenClaims, SignedPortalAccessToken } from '../application/ports/IPortalTokenService';

/** Signs/verifies with PORTAL_JWT_SECRET - a fully separate key from the staff-side
 * JWT_ACCESS_SECRET (JwtTokenService). See PORTAL_JWT_SECRET's doc comment in
 * shared/config/env.ts for why these must never be interchangeable. */
export class JwtPortalTokenService implements IPortalTokenService {
  signAccessToken(claims: PortalAccessTokenClaims): SignedPortalAccessToken {
    const signOptions: jwt.SignOptions = {
      algorithm: 'HS256',
      expiresIn: env.PORTAL_JWT_TTL as jwt.SignOptions['expiresIn'],
    };
    const token = jwt.sign(claims, env.PORTAL_JWT_SECRET, signOptions);

    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now());

    return { token, expiresAt };
  }

  verifyAccessToken(token: string): PortalAccessTokenClaims | null {
    try {
      const payload = jwt.verify(token, env.PORTAL_JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof payload !== 'object' || payload === null) return null;
      const { sub, email } = payload as Record<string, unknown>;
      if (typeof sub !== 'string' || typeof email !== 'string') return null;
      return { sub, email };
    } catch (error) {
      logger.debug({ err: error }, 'Portal access token verification failed');
      return null;
    }
  }
}
