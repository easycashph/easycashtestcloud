import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '@shared/database/prismaClient';
import { ForbiddenError } from '@shared/errors/DomainError';
import { UnauthorizedError } from '@modules/identity/application/errors/AuthErrors';

/**
 * 2026-08-06 (user-confirmed, Roles & Permissions feature): the real, configurable replacement
 * for `requireRole`'s hard-coded, route-declared allow-lists (ADR-043's deliberate interim
 * measure, ADR-038's deferred full design). Checks the `Permission`/`RolePermission` tables that
 * have existed unused since Milestone 6 (AUDIT-3) — a live DB lookup, not embedded in the JWT, so
 * an MIS-made change on the new Roles & Permissions screen takes effect immediately for every
 * holder of that role, with no re-login required.
 *
 * Must run AFTER `requireAuth` (reads `req.authUser.roles`, same precondition as `requireRole`).
 * Imports the shared `prisma` singleton directly rather than being threaded through every
 * router's DI constructor — this is a cross-cutting concern read the same way `env` config is,
 * not a per-module repository; every one of this codebase's Prisma-backed repositories already
 * imports the same singleton the same way (see e.g. `PrismaRoleClassRepository.ts`).
 *
 * Usage: `router.post('/x', requireAuth, requirePermission('payment.record'), controller.x)`.
 */
export function requirePermission(code: string): RequestHandler {
  return async function permissionGuard(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!req.authUser) {
      next(new UnauthorizedError());
      return;
    }

    try {
      const grant = await prisma.rolePermission.findFirst({
        where: {
          permission: { code },
          role: { name: { in: req.authUser.roles } },
        },
        select: { roleId: true },
      });
      if (!grant) {
        next(new ForbiddenError());
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
