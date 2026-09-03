import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import { formatSoaNumber } from './formatSoaNumber';

/** See schema.prisma's `SoaPenaltyMode` enum for what each mode means. */
export type SoaPenaltyMode = 'RECORDED' | 'COMPUTED' | 'MANUAL';

export interface GeneratedStatementOfAccountProps {
  id: string;
  loanAccountId: string;
  soaSequenceNumber: number;
  penaltyMode: SoaPenaltyMode;
  /** Null whenever `penaltyMode` is `RECORDED` — that mode asks staff for no dates. */
  penaltyFromDate: Date | null;
  penaltyToDate: Date | null;
  /** `COMPUTED` only — see schema.prisma's own doc comment. Always `false` under `RECORDED`/`MANUAL`. */
  penaltyRecomputeAll: boolean;
  /** Required under `MANUAL`, null otherwise — see the schema's own doc comment for why. */
  penaltyManualReason: string | null;
  accruedInterestAsOfDate: Date;
  /** Null when Accrued Interest had no rate to apply (e.g. no `contractualInterestRate` on the loan
   * and no manual override given either) - see schema.prisma's own doc comment. */
  accruedInterestRate: Percentage | null;
  currentAmortizationDue: Money;
  pastDuePrincipal: Money;
  pastDueInterest: Money;
  pastDuePenalty: Money;
  totalPastDue: Money;
  accruedInterest: Money;
  collectionFee: Money;
  otherFee: Money;
  totalAmountDue: Money;
  storageKey: string;
  generatedByUserId: string;
  generatedAt: Date;
}

export interface CreateGeneratedStatementOfAccountProps {
  loanAccountId: string;
  soaSequenceNumber: number;
  penaltyMode: SoaPenaltyMode;
  penaltyFromDate: Date | null;
  penaltyToDate: Date | null;
  /** `COMPUTED` only — see schema.prisma's own doc comment. Always `false` under `RECORDED`/`MANUAL`. */
  penaltyRecomputeAll: boolean;
  /** Required under `MANUAL`, null otherwise — see the schema's own doc comment for why. */
  penaltyManualReason: string | null;
  accruedInterestAsOfDate: Date;
  /** Null when Accrued Interest had no rate to apply (e.g. no `contractualInterestRate` on the loan
   * and no manual override given either) - see schema.prisma's own doc comment. */
  accruedInterestRate: Percentage | null;
  currentAmortizationDue: Money;
  pastDuePrincipal: Money;
  pastDueInterest: Money;
  pastDuePenalty: Money;
  totalPastDue: Money;
  accruedInterest: Money;
  collectionFee: Money;
  otherFee: Money;
  totalAmountDue: Money;
  storageKey: string;
  generatedByUserId: string;
  /** Must be the exact same instant used to compute `soaNumber`'s date part and the PDF's `StatementDate` placeholder (`GenerateStatementOfAccountUseCase`'s `statementDate`) - defaults to `new Date()` only for callers (e.g. tests) that don't already have one, since calling `new Date()` twice risks an off-by-one-day mismatch across a midnight boundary. */
  generatedAt?: Date;
}

/**
 * Append-only, like `GeneratedLoanDocument` — every generation is its own permanent, immutable
 * snapshot of the figures shown to/sent to the borrower at that moment (see schema.prisma's own
 * doc comment on the underlying table for the full rationale). There is no "regenerate the same
 * row" operation; a new statement is always a new row.
 */
export class GeneratedStatementOfAccount {
  private constructor(private readonly props: GeneratedStatementOfAccountProps) {}

  static create(input: CreateGeneratedStatementOfAccountProps): GeneratedStatementOfAccount {
    return new GeneratedStatementOfAccount({
      id: randomUUID(),
      ...input,
      generatedAt: input.generatedAt ?? new Date(),
    });
  }

  static reconstitute(props: GeneratedStatementOfAccountProps): GeneratedStatementOfAccount {
    return new GeneratedStatementOfAccount(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanAccountId(): string {
    return this.props.loanAccountId;
  }

  get soaSequenceNumber(): number {
    return this.props.soaSequenceNumber;
  }

  /** `SOA-{5-digit soaSequenceNumber}-{MMDDYYYY of generatedAt}` — see `formatSoaNumber`'s own doc comment. */
  get soaNumber(): string {
    return formatSoaNumber(this.props.soaSequenceNumber, this.props.generatedAt);
  }

  get penaltyMode(): SoaPenaltyMode {
    return this.props.penaltyMode;
  }

  /** Null whenever `penaltyMode` is `RECORDED` — see that mode's own doc comment. */
  get penaltyFromDate(): Date | null {
    return this.props.penaltyFromDate;
  }

  get penaltyToDate(): Date | null {
    return this.props.penaltyToDate;
  }

  get penaltyRecomputeAll(): boolean {
    return this.props.penaltyRecomputeAll;
  }

  get penaltyManualReason(): string | null {
    return this.props.penaltyManualReason;
  }

  get accruedInterestAsOfDate(): Date {
    return this.props.accruedInterestAsOfDate;
  }

  get accruedInterestRate(): Percentage | null {
    return this.props.accruedInterestRate;
  }

  get currentAmortizationDue(): Money {
    return this.props.currentAmortizationDue;
  }

  get pastDuePrincipal(): Money {
    return this.props.pastDuePrincipal;
  }

  get pastDueInterest(): Money {
    return this.props.pastDueInterest;
  }

  get pastDuePenalty(): Money {
    return this.props.pastDuePenalty;
  }

  get totalPastDue(): Money {
    return this.props.totalPastDue;
  }

  get accruedInterest(): Money {
    return this.props.accruedInterest;
  }

  get collectionFee(): Money {
    return this.props.collectionFee;
  }

  get otherFee(): Money {
    return this.props.otherFee;
  }

  get totalAmountDue(): Money {
    return this.props.totalAmountDue;
  }

  get storageKey(): string {
    return this.props.storageKey;
  }

  get generatedByUserId(): string {
    return this.props.generatedByUserId;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }
}
