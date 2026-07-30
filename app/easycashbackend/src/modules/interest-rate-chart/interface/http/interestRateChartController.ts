import type { NextFunction, Request, Response } from 'express';
import type { ListInterestRateChartUseCase } from '../../application/use-cases/ListInterestRateChartUseCase';
import { presentInterestRateChartEntry } from './presenters/InterestRateChartPresenter';

export interface InterestRateChartControllerDeps {
  listInterestRateChartUseCase: ListInterestRateChartUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class InterestRateChartController {
  constructor(private readonly deps: InterestRateChartControllerDeps) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entries = await this.deps.listInterestRateChartUseCase.execute();
      // Unpaginated by design — a small, static reference table (~140 rows), same acceptance
      // pattern as the payment-reminder/dashboard modules' own unpaginated lists.
      res.status(200).json({ items: entries.map(presentInterestRateChartEntry) });
    } catch (error) {
      next(error);
    }
  };
}
