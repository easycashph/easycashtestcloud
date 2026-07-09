import type { NextFunction, Request, Response } from 'express';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import type { ListPaymentRemindersUseCase } from '../../application/use-cases/ListPaymentRemindersUseCase';
import { presentPaymentReminder } from './presenters/PaymentReminderPresenter';

export interface PaymentReminderControllerDeps {
  listPaymentRemindersUseCase: ListPaymentRemindersUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class PaymentReminderController {
  constructor(private readonly deps: PaymentReminderControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const candidates = await this.deps.listPaymentRemindersUseCase.execute(resolveBranchFilter(scope));
      // Unpaginated by design, like the dashboard summary — one row per active loan account's
      // next-due installment, bounded by the same "thousands, not 100,000+" volume this codebase
      // already accepts elsewhere (see PrismaDashboardRepository's doc comment).
      res.status(200).json({ items: candidates.map(presentPaymentReminder) });
    } catch (error) {
      next(error);
    }
  };
}
