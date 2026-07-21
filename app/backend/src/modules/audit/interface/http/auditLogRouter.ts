import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import { AuditLogController, type AuditLogControllerDeps } from './auditLogController';

/** Mirrors the mock UI's `canViewActivityLogs` — MIS only. No branch dimension exists on AuditLog, so this is a single global gate, not per-branch scoping. */
export function createAuditLogRouter(deps: AuditLogControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new AuditLogController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/audit-logs', requireAuth, requireRole('MIS'), controller.list);

  /**
   * Any authenticated user may see a stripped-down "who did what" feed (Dashboard's Recent System
   * Activity widget) - unlike `GET /audit-logs`, this omits previousValue/newValue/ipAddress/
   * userAgent/userEmail so it's safe for every role, not just MIS.
   */
  router.get('/audit-logs/recent-activity', requireAuth, controller.listRecentActivity);

  /** Any authenticated user may log their own page view — not MIS-gated, unlike reading the list back. */
  router.post('/audit-logs/view', requireAuth, controller.logView);

  return router;
}
