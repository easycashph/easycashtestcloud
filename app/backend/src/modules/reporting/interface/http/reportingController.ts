import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import { ValidationError } from '@shared/errors/DomainError';
import type { GetLoanOriginationReportUseCase } from '../../application/use-cases/GetLoanOriginationReportUseCase';
import type { GetCollectionReportUseCase } from '../../application/use-cases/GetCollectionReportUseCase';
import type { ListReportTransactionsUseCase } from '../../application/use-cases/ListReportTransactionsUseCase';
import type { ReportGranularity } from '../../application/ports/IReportingRepository';
import { presentTransactionReportRow } from './presenters/ReportPresenter';

export interface ReportingControllerDeps {
  getLoanOriginationReportUseCase: GetLoanOriginationReportUseCase;
  getCollectionReportUseCase: GetCollectionReportUseCase;
  listReportTransactionsUseCase: ListReportTransactionsUseCase;
}

const GRANULARITIES: ReportGranularity[] = ['DAILY', 'MONTHLY', 'YEARLY'];

function parseGranularity(value: unknown): ReportGranularity {
  const upper = typeof value === 'string' ? value.toUpperCase() : '';
  if (!GRANULARITIES.includes(upper as ReportGranularity)) {
    throw new ValidationError(`granularity must be one of ${GRANULARITIES.join(', ')}.`);
  }
  return upper as ReportGranularity;
}

function parseDate(value: unknown, paramName: string): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ValidationError(`${paramName} must be a date string.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${paramName} is not a valid date.`);
  return parsed;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class ReportingController {
  constructor(private readonly deps: ReportingControllerDeps) {}

  loanOrigination = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const granularity = parseGranularity(req.query.granularity);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const rows = await this.deps.getLoanOriginationReportUseCase.execute(granularity, { from, to, branchId: resolveBranchFilter(scope) });
      res.status(200).json({ items: rows });
    } catch (error) {
      next(error);
    }
  };

  collections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const granularity = parseGranularity(req.query.granularity);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const rows = await this.deps.getCollectionReportUseCase.execute(granularity, { from, to, branchId: resolveBranchFilter(scope) });
      res.status(200).json({ items: rows });
    } catch (error) {
      next(error);
    }
  };

  transactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const rows = await this.deps.listReportTransactionsUseCase.execute({
        limit,
        cursor,
        from,
        to,
        type,
        branchId: resolveBranchFilter(scope),
      });
      res.status(200).json(toPaginatedResponse(rows.map(presentTransactionReportRow), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };
}
