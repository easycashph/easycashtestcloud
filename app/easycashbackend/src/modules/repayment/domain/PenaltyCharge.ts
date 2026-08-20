import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface PenaltyChargeProps {
  id: string;
  repaymentInstallmentId: string;
  loanTransactionId: string;
  previousPenaltyAmount: Money;
  newPenaltyAmount: Money;
  reason: string;
  chargedByUserId: string;
  createdAt: Date;
}

export interface CreatePenaltyChargeProps {
  repaymentInstallmentId: string;
  loanTransactionId: string;
  previousPenaltyAmount: Money;
  newPenaltyAmount: Money;
  reason: string;
  chargedByUserId: string;
}

/**
 * 2026-08-19 (Add Penalty feature) — mirrors `FeeCharge` exactly, but for penalty; see that class's
 * own doc comment for the "historical record, never edited" posture. `loanTransactionId` links to
 * the `PENALTY_APPLIED` `LoanTransaction` this action also creates (TXN-1: no balance change
 * without a corresponding transaction row).
 */
export class PenaltyCharge {
  private constructor(private readonly props: PenaltyChargeProps) {}

  static create(input: CreatePenaltyChargeProps): PenaltyCharge {
    return new PenaltyCharge({
      id: randomUUID(),
      repaymentInstallmentId: input.repaymentInstallmentId,
      loanTransactionId: input.loanTransactionId,
      previousPenaltyAmount: input.previousPenaltyAmount,
      newPenaltyAmount: input.newPenaltyAmount,
      reason: input.reason,
      chargedByUserId: input.chargedByUserId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: PenaltyChargeProps): PenaltyCharge {
    return new PenaltyCharge(props);
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

  get previousPenaltyAmount(): Money {
    return this.props.previousPenaltyAmount;
  }

  get newPenaltyAmount(): Money {
    return this.props.newPenaltyAmount;
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
