import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import { ValidationError } from '@shared/errors/DomainError';
import type { GetLoanOriginationReportUseCase } from '../../application/use-cases/GetLoanOriginationReportUseCase';
import type { GetCollectionReportUseCase } from '../../application/use-cases/GetCollectionReportUseCase';
import type { ListReportTransactionsUseCase } from '../../application/use-cases/ListReportTransactionsUseCase';
import type { GetLoanReleasesReportUseCase } from '../../application/use-cases/GetLoanReleasesReportUseCase';
import type { GetAgingReportUseCase } from '../../application/use-cases/GetAgingReportUseCase';
import type { GetEndingBalanceReportUseCase } from '../../application/use-cases/GetEndingBalanceReportUseCase';
import type { GetAccountsWithPastDueReportUseCase } from '../../application/use-cases/GetAccountsWithPastDueReportUseCase';
import type { GetCollectionHistoryReportUseCase } from '../../application/use-cases/GetCollectionHistoryReportUseCase';
import type { GetExpectedCollectionReportUseCase } from '../../application/use-cases/GetExpectedCollectionReportUseCase';
import type { GetFirstAmortizationReportUseCase } from '../../application/use-cases/GetFirstAmortizationReportUseCase';
import type { GetDailyCollectionReportUseCase } from '../../application/use-cases/GetDailyCollectionReportUseCase';
import type { GetFullyPaidAccountsReportUseCase } from '../../application/use-cases/GetFullyPaidAccountsReportUseCase';
import type { ReportGranularity } from '../../application/ports/IReportingRepository';
import type { ExcelJsLoanReleasesReportWriter } from '../../infrastructure/ExcelJsLoanReleasesReportWriter';
import {
  writeAccountsWithPastDueReportXlsx,
  writeAgingReportXlsx,
  writeCollectionHistoryReportXlsx,
  writeDailyCollectionReportXlsx,
  writeEndingBalanceReportXlsx,
  writeExpectedCollectionReportXlsx,
  writeFirstAmortizationReportXlsx,
  writeFullyPaidAccountsReportXlsx,
} from '../../infrastructure/reportWriters';
import { presentTransactionReportRow } from './presenters/ReportPresenter';

export interface ReportingControllerDeps {
  getLoanOriginationReportUseCase: GetLoanOriginationReportUseCase;
  getCollectionReportUseCase: GetCollectionReportUseCase;
  listReportTransactionsUseCase: ListReportTransactionsUseCase;
  getLoanReleasesReportUseCase: GetLoanReleasesReportUseCase;
  loanReleasesReportWriter: ExcelJsLoanReleasesReportWriter;
  getAgingReportUseCase: GetAgingReportUseCase;
  getEndingBalanceReportUseCase: GetEndingBalanceReportUseCase;
  getAccountsWithPastDueReportUseCase: GetAccountsWithPastDueReportUseCase;
  getCollectionHistoryReportUseCase: GetCollectionHistoryReportUseCase;
  getExpectedCollectionReportUseCase: GetExpectedCollectionReportUseCase;
  getFirstAmortizationReportUseCase: GetFirstAmortizationReportUseCase;
  getDailyCollectionReportUseCase: GetDailyCollectionReportUseCase;
  getFullyPaidAccountsReportUseCase: GetFullyPaidAccountsReportUseCase;
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

  loanReleasesXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const rows = await this.deps.getLoanReleasesReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await this.deps.loanReleasesReportWriter.write(rows);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Monthly Loan Releases.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  agingXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const rows = await this.deps.getAgingReportUseCase.execute({ branchId: resolveBranchFilter(scope) });
      const buffer = await writeAgingReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Aging Report.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  endingBalanceXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const rows = await this.deps.getEndingBalanceReportUseCase.execute({ branchId: resolveBranchFilter(scope) });
      const buffer = await writeEndingBalanceReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Detailed Ending Current Balance.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  accountsWithPastDueXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const rows = await this.deps.getAccountsWithPastDueReportUseCase.execute({ branchId: resolveBranchFilter(scope) });
      const buffer = await writeAccountsWithPastDueReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Accounts with Past Due.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  collectionHistoryXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const rows = await this.deps.getCollectionHistoryReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeCollectionHistoryReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Collection.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  expectedCollectionXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const rows = await this.deps.getExpectedCollectionReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeExpectedCollectionReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Expected Collection.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  firstAmortizationXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const rows = await this.deps.getFirstAmortizationReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeFirstAmortizationReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="First Amortization.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  dailyCollectionXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from');
      const to = parseDate(req.query.to, 'to');
      const rows = await this.deps.getDailyCollectionReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeDailyCollectionReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Daily Collection Report.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  fullyPaidXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const rows = await this.deps.getFullyPaidAccountsReportUseCase.execute({ branchId: resolveBranchFilter(scope) });
      const buffer = await writeFullyPaidAccountsReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Fully Paid Accounts.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
