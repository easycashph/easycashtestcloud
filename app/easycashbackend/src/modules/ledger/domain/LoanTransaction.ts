import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import { TransactionComponents } from './valueObjects/TransactionComponents';
import { ComponentSumMismatchError } from './errors/LedgerDomainErrors';

export type LoanTransactionType =
  | 'DISBURSEMENT'
  | 'REPAYMENT'
  | 'FEE_CHARGED'
  | 'PENALTY_APPLIED'
  | 'INTEREST_APPLIED'
  | 'DEFERRED_INTEREST_APPLIED'
  | 'DEFERRED_INTEREST_PAID'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'REVERSAL'
  // 2026-08-15 — migrated SDevTech history only, never produced by this system's own payment
  // flow (which records one REPAYMENT with fee/penalty components instead). See the
  // `LoanTransactionType` enum's own doc comment in schema.prisma for the full rationale.
  | 'FEE_REPAYMENT'
  | 'PENALTY_REPAYMENT';

export interface LoanTransactionProps {
  id: string;
  loanAccountId: string;
  type: LoanTransactionType;
  amount: Money;
  components: TransactionComponents;
  balanceAfter: Money;
  postedByUserId?: string;
  /** Display-only, read-path convenience (never set by `create()` — that's a pure write with no
   * user-name lookup) — populated by the repository's `findByLoanAccountId` read for the presenter
   * to surface "Recorded by X" without a second query. `undefined` for legacy-migrated rows (no
   * `postedByUserId`) or a freshly-constructed entity before its first save. Same convention as
   * `PenaltyOverride.byName` in the repayment module. */
  postedByName?: string;
  branchId: string;
  entryDate: Date;
  comment?: string;
  orNumber?: string;
  arNumber?: string;
  /** 2026-07-17 (Reports) — the payment channel/mode selected on Record Payment, one of
   * `ACTIVE_PAYMENT_METHODS`' `code` values. See schema.prisma's own doc comment. */
  paymentMethod?: string;
  reversesTransactionId?: string;
  legacyId?: string;
  createdAt: Date;
}

export interface CreateLoanTransactionProps {
  loanAccountId: string;
  type: LoanTransactionType;
  amount: Money;
  components?: Partial<{
    principalComponent: Money;
    interestComponent: Money;
    feesComponent: Money;
    penaltyComponent: Money;
  }>;
  balanceAfter: Money;
  postedByUserId?: string;
  branchId: string;
  entryDate: Date;
  comment?: string;
  orNumber?: string;
  arNumber?: string;
  paymentMethod?: string;
  reversesTransactionId?: string;
  legacyId?: string;
}

/**
 * Independent aggregate root (ADR-042 §6) — TXN-1: append-only, no setters
 * anywhere on this class. Corrections must be a NEW transaction (type
 * REVERSAL, `reversesTransactionId` pointing at the original), never an
 * edit of an existing instance — this class makes an edit impossible to
 * express, not just discouraged.
 *
 * This entity only RECORDS an already-computed transaction; it never
 * derives `amount`, `components`, or `balanceAfter` itself — that
 * computation belongs to the not-yet-built calculation/payment-allocation
 * engine (out of scope for Milestone 7).
 */
export class LoanTransaction {
  private constructor(private readonly props: LoanTransactionProps) {}

  static create(input: CreateLoanTransactionProps): LoanTransaction {
    const components = TransactionComponents.of(input.components ?? {});
    const componentSum = components.sum();
    if (!componentSum.equals(input.amount)) {
      throw new ComponentSumMismatchError(input.amount.toString(), componentSum.toString());
    }

    return new LoanTransaction({
      id: randomUUID(),
      loanAccountId: input.loanAccountId,
      type: input.type,
      amount: input.amount,
      components,
      balanceAfter: input.balanceAfter,
      postedByUserId: input.postedByUserId,
      branchId: input.branchId,
      entryDate: input.entryDate,
      comment: input.comment,
      orNumber: input.orNumber,
      arNumber: input.arNumber,
      paymentMethod: input.paymentMethod,
      reversesTransactionId: input.reversesTransactionId,
      legacyId: input.legacyId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: LoanTransactionProps): LoanTransaction {
    return new LoanTransaction(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanAccountId(): string {
    return this.props.loanAccountId;
  }

  get type(): LoanTransactionType {
    return this.props.type;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get components(): TransactionComponents {
    return this.props.components;
  }

  get balanceAfter(): Money {
    return this.props.balanceAfter;
  }

  get postedByUserId(): string | undefined {
    return this.props.postedByUserId;
  }

  get postedByName(): string | undefined {
    return this.props.postedByName;
  }

  get branchId(): string {
    return this.props.branchId;
  }

  get entryDate(): Date {
    return this.props.entryDate;
  }

  get comment(): string | undefined {
    return this.props.comment;
  }

  get orNumber(): string | undefined {
    return this.props.orNumber;
  }

  get arNumber(): string | undefined {
    return this.props.arNumber;
  }

  get paymentMethod(): string | undefined {
    return this.props.paymentMethod;
  }

  get reversesTransactionId(): string | undefined {
    return this.props.reversesTransactionId;
  }

  get legacyId(): string | undefined {
    return this.props.legacyId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
