import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError } from '@shared/errors/DomainError';
import { UnauthorizedError } from '@modules/identity/application/errors/AuthErrors';

/**
 * Milestone 8 / ADR-043: minimal, interim role-based authorization gate —
 * NOT a permission matrix, NOT a policy engine, NOT dynamic (see the ADR
 * for the full rationale and what this deliberately does not do).
 *
 * Checks the already-verified JWT `roles` claim against a hard-coded,
 * route-declared allow-list. Must run AFTER `requireAuth` in a route's
 * middleware chain — it reads `req.authUser`, which only `requireAuth`
 * populates.
 *
 * Deliberately does its own `req.authUser` check (mirroring `requireAuth`'s
 * own explicit-check style) rather than calling `requireAuth`'s
 * `getCurrentUser()` helper, which throws synchronously instead of calling
 * `next(error)` — correct for a controller's own try/catch, but not for a
 * standalone middleware, which must always signal failure via `next()`.
 *
 * Usage: `router.post('/x', requireAuth, requireRole('MIS', 'Loan Operation Manager'), controller.x)`.
 */
export function requireRole(...allowedRoles: string[]): RequestHandler {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    if (!req.authUser) {
      next(new UnauthorizedError());
      return;
    }

    const hasAllowedRole = req.authUser.roles.some((role) => allowedRoles.includes(role));
    if (!hasAllowedRole) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
