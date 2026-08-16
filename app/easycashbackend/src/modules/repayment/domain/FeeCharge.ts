import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface FeeChargeProps {
  id: string;
  repaymentInstallmentId: string;
  loanTransactionId: string;
  previousFeesAmount: Money;
  newFeesAmount: Money;
  reason: string;
  chargedByUserId: string;
  createdAt: Date;
}

export interface CreateFeeChargeProps {
  repaymentInstallmentId: string;
  loanTransactionId: string;
  previousFeesAmount: Money;
  newFeesAmount: Money;
  reason: string;
  chargedByUserId: string;
}

/**
 * 2026-08-15 (Add Fee feature) — one immutable row per charge action, same "historical record,
 * never edited" posture as `PenaltyReduction`/`FeeAdjustment`. See this model's own doc comment in
 * schema.prisma for why it's a distinct concept from `FeeAdjustment` (a charge adds a new
 * obligation; an adjustment corrects an existing one). `loanTransactionId` links to the
 * `FEE_CHARGED` `LoanTransaction` this action also creates — unlike `FeeAdjustment` (no ledger
 * impact of its own), a charge is a real financial event and must have a transaction behind it
 * (TXN-1: no balance change without a corresponding transaction row).
 */
export class FeeCharge {
  private constructor(private readonly props: FeeChargeProps) {}

  static create(input: CreateFeeChargeProps): FeeCharge {
    return new FeeCharge({
      id: randomUUID(),
      repaymentInstallmentId: input.repaymentInstallmentId,
      loanTransactionId: input.loanTransactionId,
      previousFeesAmount: input.previousFeesAmount,
      newFeesAmount: input.newFeesAmount,
      reason: input.reason,
      chargedByUserId: input.chargedByUserId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: FeeChargeProps): FeeCharge {
    return new FeeCharge(props);
  }

  get id(): string {
    return this.props.id;
  }

  get repaymentInstallmentId(): string {
    return this.props.repaymentInstallmentId;
  }

  get loanTransactionId(): string {
    return this.props.loanTransactionId;
  }

  get previousFeesAmount(): Money {
    return this.props.previousFeesAmount;
  }

  get newFeesAmount(): Money {
    return this.props.newFeesAmount;
  }

  get reason(): string {
    return this.props.reason;
  }

  get chargedByUserId(): string {
    return this.props.chargedByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
