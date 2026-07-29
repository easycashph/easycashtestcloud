import type { NextFunction, Request, Response } from 'express';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import type { GetDashboardSummaryUseCase } from '../../application/use-cases/GetDashboardSummaryUseCase';
import { presentDashboardSummary } from './presenters/DashboardPresenter';

export interface DashboardControllerDeps {
  getDashboardSummaryUseCase: GetDashboardSummaryUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture). */
export class DashboardController {
  constructor(private readonly deps: DashboardControllerDeps) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const summary = await this.deps.getDashboardSummaryUseCase.execute(resolveBranchFilter(scope));
      res.status(200).json(presentDashboardSummary(summary));
    } catch (error) {
      next(error);
    }
  };
}
