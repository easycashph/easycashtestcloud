import type { NextFunction, Request, Response } from 'express';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import type { ListEmailReminderLogsUseCase } from '../../application/use-cases/ListEmailReminderLogsUseCase';
import { presentEmailReminderLog } from './presenters/EmailReminderLogPresenter';

export interface EmailReminderLogControllerDeps {
  listEmailReminderLogsUseCase: ListEmailReminderLogsUseCase;
}

/** Thin controller only - mirrors SmsReminderLogController exactly. */
export class EmailReminderLogController {
  constructor(private readonly deps: EmailReminderLogControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const loanAccountId = typeof req.query.loanAccountId === 'string' ? req.query.loanAccountId : undefined;
      const logs = await this.deps.listEmailReminderLogsUseCase.execute(resolveBranchFilter(scope), loanAccountId);
      res.status(200).json({ items: logs.map(presentEmailReminderLog) });
    } catch (error) {
      next(error);
    }
  };
}
