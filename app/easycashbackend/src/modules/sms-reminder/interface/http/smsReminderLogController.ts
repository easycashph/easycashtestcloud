import type { NextFunction, Request, Response } from 'express';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import type { ListSmsReminderLogsUseCase } from '../../application/use-cases/ListSmsReminderLogsUseCase';
import { presentSmsReminderLog } from './presenters/SmsReminderLogPresenter';

export interface SmsReminderLogControllerDeps {
  listSmsReminderLogsUseCase: ListSmsReminderLogsUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class SmsReminderLogController {
  constructor(private readonly deps: SmsReminderLogControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const loanAccountId = typeof req.query.loanAccountId === 'string' ? req.query.loanAccountId : undefined;
      const logs = await this.deps.listSmsReminderLogsUseCase.execute(resolveBranchFilter(scope), loanAccountId);
      res.status(200).json({ items: logs.map(presentSmsReminderLog) });
    } catch (error) {
      next(error);
    }
  };
}
