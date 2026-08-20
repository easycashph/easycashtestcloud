import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import { resolveBranchFilter, resolveBranchScope } from '@shared/http/branchScope';
import { ValidationError } from '@shared/errors/DomainError';
import { manilaDayRange } from '@shared/domain/manilaTime';
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
import type { ListDistinctChannelsUseCase } from '../../application/use-cases/ListDistinctChannelsUseCase';
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
import {
  presentAccountsWithPastDueReportRow,
  presentCollectionHistoryReportRow,
  presentDailyCollectionReportRow,
  presentExpectedCollectionReportRow,
  presentFirstAmortizationReportRow,
  presentFullyPaidAccountsReportRow,
  presentLoanReleaseReportRow,
  presentTransactionReportRow,
} from './presenters/ReportPresenter';

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
  listDistinctChannelsUseCase: ListDistinctChannelsUseCase;
}

const GRANULARITIES: ReportGranularity[] = ['DAILY', 'MONTHLY', 'YEARLY'];

function parseGranularity(value: unknown): ReportGranularity {
  const upper = typeof value === 'string' ? value.toUpperCase() : '';
  if (!GRANULARITIES.includes(upper as ReportGranularity)) {
    throw new ValidationError(`granularity must be one of ${GRANULARITIES.join(', ')}.`);
  }
  return upper as ReportGranularity;
}

/**
 * 2026-08-06 (user-reported): every report's "from"/"to" filter is a plain `type="date"` input
 * (see `DateRangeFilter.tsx`) meant as an Asia/Manila calendar day - but a transaction/loan's own
 * date-only fields are stored as that Manila day's UTC-shifted midnight (`entryDate`
 * "2026-08-03T16:00:00.000Z" = Manila Aug 4), same convention `manilaDayRange` already handles for
 * SMS/email reminders. Parsing "from"/"to" as literal UTC midnight (the old behavior) put the
 * boundary 8 hours AFTER a same-Manila-day record's real timestamp, silently excluding it. `from`
 * now resolves to the Manila day's start, `to` to its last instant (`end - 1`) - both in UTC, so
 * every report using these values via `entryDateFilter`/`filter.from`/`filter.to` gets a
 * Manila-calendar-day-accurate range instead of a UTC one.
 */
function parseDate(value: unknown, paramName: string, boundary: 'start' | 'end'): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new ValidationError(`${paramName} must be a date string.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${paramName} is not a valid date.`);
  const range = manilaDayRange(parsed);
  return boundary === 'start' ? range.start : new Date(range.end.getTime() - 1);
}

/**
 * 2026-08-15: the Transaction Report's type filter became multi-select, so `?type=` may now repeat
 * (`?type=REPAYMENT&type=FEE_REPAYMENT`). Express hands a single occurrence back as a string and a
 * repeated one as an array — both shapes are normalised here to one array. A single `?type=X` still
 * works exactly as before, so any bookmarked URL or external caller keeps working.
 *
 * Returns undefined (no filter at all, i.e. every type) when nothing usable was supplied — an empty
 * array would otherwise read as "match none" downstream.
 */
/** 2026-08-15: generic - also used for the `channel` multi-select filter below, same "single value
 * or repeated" normalization either query param needs. */
function parseMultiValueFilter(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : [value];
  const values = raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class ReportingController {
  constructor(private readonly deps: ReportingControllerDeps) {}

  loanOrigination = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const granularity = parseGranularity(req.query.granularity);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
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
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
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
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.listReportTransactionsUseCase.execute({
        limit,
        cursor,
        from,
        to,
        types: parseMultiValueFilter(req.query.type),
        channels: parseMultiValueFilter(req.query.channel),
        branchId: resolveBranchFilter(scope),
      });
      res.status(200).json(toPaginatedResponse(rows.map(presentTransactionReportRow), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-15: powers the Transaction Report's channel filter dropdown - the distinct set of
   * `paymentMethod` values actually in use, each with its display label. */
  channels = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const channels = await this.deps.listDistinctChannelsUseCase.execute();
      res.status(200).json({ items: channels });
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-17 (user request): JSON counterpart to `loanReleasesXlsx` below, for the report's new
   * on-screen table - not paginated (matches every other in-page report table, e.g.
   * `transactions`'s underlying data volume: a date-range-scoped list, not the whole ledger). */
  loanReleases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getLoanReleasesReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      res.status(200).json({ items: rows.map(presentLoanReleaseReportRow) });
    } catch (error) {
      next(error);
    }
  };

  loanReleasesXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
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

  /** 2026-08-20 (user request): JSON counterpart to `accountsWithPastDueXlsx` below, for the
   * report's new on-screen table - same "not paginated, date-range-scoped" posture as `loanReleases`. */
  accountsWithPastDue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getAccountsWithPastDueReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      res.status(200).json({ items: rows.map(presentAccountsWithPastDueReportRow) });
    } catch (error) {
      next(error);
    }
  };

  accountsWithPastDueXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getAccountsWithPastDueReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeAccountsWithPastDueReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Accounts with Past Due.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-20 (user request): JSON counterpart to `collectionHistoryXlsx` below. */
  collectionHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getCollectionHistoryReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      res.status(200).json({ items: rows.map(presentCollectionHistoryReportRow) });
    } catch (error) {
      next(error);
    }
  };

  collectionHistoryXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getCollectionHistoryReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeCollectionHistoryReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Collection.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-19 (user request): JSON counterpart to `expectedCollectionXlsx` below, for the
   * report's new on-screen table - same "not paginated, date-range-scoped" posture as `loanReleases`.
   * 2026-08-20 (user request): added a multi-select `product` filter (repeated `product` query
   * params, one per `LoanProduct.code` - same `parseMultiValueFilter` normalization as `type`/`channel`). */
  expectedCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getExpectedCollectionReportUseCase.execute({
        from,
        to,
        branchId: resolveBranchFilter(scope),
        productCodes: parseMultiValueFilter(req.query.product),
      });
      res.status(200).json({ items: rows.map(presentExpectedCollectionReportRow) });
    } catch (error) {
      next(error);
    }
  };

  expectedCollectionXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getExpectedCollectionReportUseCase.execute({
        from,
        to,
        branchId: resolveBranchFilter(scope),
        productCodes: parseMultiValueFilter(req.query.product),
      });
      const buffer = await writeExpectedCollectionReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Expected Collection.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-20 (user request): JSON counterpart to `firstAmortizationXlsx` below. */
  firstAmortization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getFirstAmortizationReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      res.status(200).json({ items: rows.map(presentFirstAmortizationReportRow) });
    } catch (error) {
      next(error);
    }
  };

  firstAmortizationXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getFirstAmortizationReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeFirstAmortizationReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="First Amortization.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-20 (user request): JSON counterpart to `dailyCollectionXlsx` below. */
  dailyCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getDailyCollectionReportUseCase.execute({
        from,
        to,
        types: parseMultiValueFilter(req.query.type),
        channels: parseMultiValueFilter(req.query.channel),
        branchId: resolveBranchFilter(scope),
      });
      res.status(200).json({ items: rows.map(presentDailyCollectionReportRow) });
    } catch (error) {
      next(error);
    }
  };

  dailyCollectionXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getDailyCollectionReportUseCase.execute({
        from,
        to,
        types: parseMultiValueFilter(req.query.type),
        channels: parseMultiValueFilter(req.query.channel),
        branchId: resolveBranchFilter(scope),
      });
      const buffer = await writeDailyCollectionReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Daily Collection Report.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  /** 2026-08-20 (user request): JSON counterpart to `fullyPaidXlsx` below. */
  fullyPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getFullyPaidAccountsReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      res.status(200).json({ items: rows.map(presentFullyPaidAccountsReportRow) });
    } catch (error) {
      next(error);
    }
  };

  fullyPaidXlsx = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const from = parseDate(req.query.from, 'from', 'start');
      const to = parseDate(req.query.to, 'to', 'end');
      const rows = await this.deps.getFullyPaidAccountsReportUseCase.execute({ from, to, branchId: resolveBranchFilter(scope) });
      const buffer = await writeFullyPaidAccountsReportXlsx(rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Fully Paid Accounts.xlsx"');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
