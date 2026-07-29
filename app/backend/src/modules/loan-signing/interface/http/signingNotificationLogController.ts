import type { NextFunction, Request, Response } from 'express';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import type { ListSigningNotificationLogsUseCase } from '../../application/use-cases/ListSigningNotificationLogsUseCase';
import { presentSigningNotificationLog } from './presenters/SigningNotificationLogPresenter';

export interface SigningNotificationLogControllerDeps {
  listSigningNotificationLogsUseCase: ListSigningNotificationLogsUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), matching SmsReminderLogController's shape. */
export class SigningNotificationLogController {
  constructor(private readonly deps: SigningNotificationLogControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const loanAccountId = typeof req.query.loanAccountId === 'string' ? req.query.loanAccountId : undefined;
      const logs = await this.deps.listSigningNotificationLogsUseCase.execute(resolveBranchFilter(scope), loanAccountId);
      res.status(200).json({ items: logs.map(presentSigningNotificationLog) });
    } catch (error) {
      next(error);
    }
  };
}
