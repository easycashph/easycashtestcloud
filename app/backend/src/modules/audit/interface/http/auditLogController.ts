import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListAuditLogsUseCase } from '../../application/use-cases/ListAuditLogsUseCase';
import type { LogSectionViewUseCase } from '../../application/use-cases/LogSectionViewUseCase';
import { presentAuditLog } from './presenters/AuditLogPresenter';

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
      const records = await this.deps.listAuditLogsUseCase.execute({ limit, cursor, search, entityTypes, entityId });
      res.status(200).json(toPaginatedResponse(records.map(presentAuditLog), limit, (item) => item.id));
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
