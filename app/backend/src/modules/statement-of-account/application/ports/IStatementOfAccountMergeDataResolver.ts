import type { Money } from '@shared/domain/Money';
import type { StatementOfAccountFigures } from '../services/StatementOfAccountCalculator';

export interface StatementOfAccountResolveResult {
  /** Flat placeholder map for `IDocumentFiller.fill('SOA', ...)` — see `docs/Architecture/ADR-052-statement-of-account-generation.md` §Placeholders for the full list. */
  mergeData: Record<string, unknown>;
  /** The computed figures, unrounded/untouched by display formatting — persisted verbatim onto `GeneratedStatementOfAccount` (the immutable snapshot). */
  figures: StatementOfAccountFigures;
}

export interface IStatementOfAccountMergeDataResolver {
  resolve(
    loanAccountId: string,
    soaNumber: string,
    statementDate: Date,
    penaltyAsOfDate: Date,
    accruedInterestAsOfDate: Date,
    collectionFee: Money,
    otherFee: Money,
  ): Promise<StatementOfAccountResolveResult>;
}
