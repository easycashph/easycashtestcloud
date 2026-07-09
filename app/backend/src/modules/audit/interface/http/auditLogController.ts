import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import type { ListAuditLogsUseCase } from '../../application/use-cases/ListAuditLogsUseCase';
import { presentAuditLog } from './presenters/AuditLogPresenter';

export interface AuditLogControllerDeps {
  listAuditLogsUseCase: ListAuditLogsUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class AuditLogController {
  constructor(private readonly deps: AuditLogControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePaginationParams(req.query);
      const records = await this.deps.listAuditLogsUseCase.execute({ limit, cursor });
      res.status(200).json(toPaginatedResponse(records.map(presentAuditLog), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };
}
