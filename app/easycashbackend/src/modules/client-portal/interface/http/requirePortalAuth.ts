import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { DomainError } from '@shared/errors/DomainError';

const BEARER_PREFIX = 'Bearer ';

class PortalUnauthorizedError extends DomainError {
  constructor() {
    super('PORTAL_UNAUTHORIZED', 'Authentication required.', undefined, 401);
    this.name = 'PortalUnauthorizedError';
  }
}

/** Mirrors identity/shared/middleware/requireAuth.ts exactly in shape, but verifies against
 * PortalTokenService (PORTAL_JWT_SECRET) and sets `req.portalAccount`, never `req.authUser` - a
 * staff access token must never pass this check, and a portal access token must never pass the
 * staff-side requireAuth. */
export function createRequirePortalAuth(portalTokenService: IPortalTokenService): RequestHandler {
  return function requirePortalAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header('authorization');
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      next(new PortalUnauthorizedError());
      return;
    }

    const token = header.slice(BEARER_PREFIX.length);
    const claims = portalTokenService.verifyAccessToken(token);
    if (!claims) {
      next(new PortalUnauthorizedError());
      return;
    }

    req.portalAccount = claims;
    next();
  };
}

export function getCurrentPortalAccount(req: Request) {
  if (!req.portalAccount) {
    throw new PortalUnauthorizedError();
  }
  return req.portalAccount;
}
