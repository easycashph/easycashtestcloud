import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { UnauthorizedError } from '@modules/identity/application/errors/AuthErrors';

const BEARER_PREFIX = 'Bearer ';

/**
 * Milestone 6 plan §7: reusable across all future modules, hence placed in
 * `shared/`, not inside `modules/identity/`. Only imports the ITokenService
 * *type* (a port interface) from the identity module — no runtime coupling
 * to identity's infrastructure; the concrete implementation is injected by
 * the composition root (app.ts).
 *
 * Verifies identity only — this milestone does NOT include a
 * `requirePermission` authorization guard (see plan §1, out of scope).
 */
export function createRequireAuth(tokenService: ITokenService): RequestHandler {
  return function requireAuth(req: Request, _res: Response, next: NextFunction): void {
    const header = req.header('authorization');
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      next(new UnauthorizedError());
      return;
    }

    const token = header.slice(BEARER_PREFIX.length);
    const claims = tokenService.verifyAccessToken(token);
    if (!claims) {
      next(new UnauthorizedError('Access token is invalid or has expired.'));
      return;
    }

    req.authUser = claims;
    next();
  };
}

/**
 * Current-user context accessor (Milestone 6 plan §7) — deliberately not a
 * second verification middleware. `requireAuth` already verified the token
 * and attached `req.authUser`; this just gives controllers a typed,
 * fail-fast way to read it instead of repeating `req.authUser!` everywhere.
 */
export function getCurrentUser(req: Request) {
  if (!req.authUser) {
    throw new UnauthorizedError();
  }
  return req.authUser;
}
