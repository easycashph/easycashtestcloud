import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListAuditLogsUseCase } from '../../application/use-cases/ListAuditLogsUseCase';
import type { LogSectionViewUseCase } from '../../application/use-cases/LogSectionViewUseCase';
import { presentAuditLog } from './presenters/AuditLogPresenter';
import { presentRecentActivity } from './presenters/RecentActivityPresenter';
import { presentLoginActivity } from './presenters/LoginActivityPresenter';

export interface AuditLogControllerDeps {
  listAuditLogsUseCase: ListAuditLogsUseCase;
  logSectionViewUseCase: LogSectionViewUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class AuditLogController {
  constructor(private readonly deps: AuditLogControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePaginationParams(req.query);
      const search = parseSearchParam(req.query);
      const entityTypes =
        typeof req.query.entityType === 'string'
          ? req.query.entityType.split(',').map((value) => value.trim()).filter(Boolean)
          : undefined;
      const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
      const excludeActions =
        typeof req.query.excludeActions === 'string'
          ? req.query.excludeActions.split(',').map((value) => value.trim()).filter(Boolean)
          : undefined;
      // Administration > System > Activity Logs (2026-07-23) - click a user's name to see every
      // entry they're the actor of. Safe to accept as a caller-supplied filter here (unlike
      // `listMyLoginActivity`'s hardcoded self-scoping) since this whole route is already
      // MIS-only (see auditLogRouter.ts) - an MIS user is allowed to look up any user's activity.
      const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
      const records = await this.deps.listAuditLogsUseCase.execute({ limit, cursor, search, entityTypes, entityId, excludeActions, userId });
      res.status(200).json(toPaginatedResponse(records.map(presentAuditLog), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  /** All-roles counterpart to `list()` — same query params minus `search`/`cursor` (the widget only needs the latest page), stripped down via `presentRecentActivity`. See auditLogRouter's doc comment. */
  listRecentActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit } = parsePaginationParams(req.query);
      const entityTypes =
        typeof req.query.entityType === 'string'
          ? req.query.entityType.split(',').map((value) => value.trim()).filter(Boolean)
          : undefined;
      const excludeActions =
        typeof req.query.excludeActions === 'string'
          ? req.query.excludeActions.split(',').map((value) => value.trim()).filter(Boolean)
          : undefined;
      const records = await this.deps.listAuditLogsUseCase.execute({ limit, entityTypes, excludeActions });
      res.status(200).json({ items: records.map(presentRecentActivity) });
    } catch (error) {
      next(error);
    }
  };

  /** Settings > Security > Recent Sign-in Activity (2026-07-21) - self-scoped to the caller
   * (`userId` is always `req.authUser.sub`, never a query param - a caller cannot request someone
   * else's sign-in history from this endpoint) and fixed to LOGIN_SUCCESS/LOGIN_FAILED only. */
  listMyLoginActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const { limit } = parsePaginationParams(req.query);
      const records = await this.deps.listAuditLogsUseCase.execute({
        limit,
        userId: currentUser.sub,
        actions: ['LOGIN_SUCCESS', 'LOGIN_FAILED'],
      });
      res.status(200).json({ items: records.map(presentLoginActivity) });
    } catch (error) {
      next(error);
    }
  };

  logView = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getCurrentUser(req);
      const { section, entityId } = req.body as { section?: string; entityId?: string };
      if (!section) {
        res.status(400).json({ error: 'Missing section' });
        return;
      }

      await this.deps.logSectionViewUseCase.execute({
        userId: user.sub,
        section,
        entityId,
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
