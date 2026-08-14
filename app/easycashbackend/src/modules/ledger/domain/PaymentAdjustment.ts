import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface PaymentAdjustmentProps {
  id: string;
  loanTransactionId: string;
  repaymentInstallmentId: string;
  previousPrincipalPaid: Money;
  previousInterestPaid: Money;
  previousFeesPaid: Money;
  previousPenaltyPaid: Money;
  newPrincipalPaid: Money;
  newInterestPaid: Money;
  newFeesPaid: Money;
  newPenaltyPaid: Money;
  reason: string;
  adjustedByUserId: string;
  createdAt: Date;
}

export interface CreatePaymentAdjustmentProps {
  loanTransactionId: string;
  repaymentInstallmentId: string;
  previousPrincipalPaid: Money;
  previousInterestPaid: Money;
  previousFeesPaid: Money;
  previousPenaltyPaid: Money;
  newPrincipalPaid: Money;
  newInterestPaid: Money;
  newFeesPaid: Money;
  newPenaltyPaid: Money;
  reason: string;
  adjustedByUserId: string;
}

/**
 * 2026-08-14 (Manual Payment Adjustment feature) — one immutable row per (transaction, installment)
 * pair corrected through this tool, same "historical record, never edited" posture as
 * `PenaltyReduction`/`FeeAdjustment`. See the Prisma schema's own doc comment on the
 * `PaymentAdjustment` model for the full rationale (the `PaymentAllocation`-less legacy transaction
 * gap this closes).
 */
export class PaymentAdjustment {
  private constructor(private readonly props: PaymentAdjustmentProps) {}

  static create(input: CreatePaymentAdjustmentProps): PaymentAdjustment {
    return new PaymentAdjustment({
      id: randomUUID(),
      loanTransactionId: input.loanTransactionId,
      repaymentInstallmentId: input.repaymentInstallmentId,
      previousPrincipalPaid: input.previousPrincipalPaid,
      previousInterestPaid: input.previousInterestPaid,
      previousFeesPaid: input.previousFeesPaid,
      previousPenaltyPaid: input.previousPenaltyPaid,
      newPrincipalPaid: input.newPrincipalPaid,
      newInterestPaid: input.newInterestPaid,
      newFeesPaid: input.newFeesPaid,
      newPenaltyPaid: input.newPenaltyPaid,
      reason: input.reason,
      adjustedByUserId: input.adjustedByUserId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: PaymentAdjustmentProps): PaymentAdjustment {
    return new PaymentAdjustment(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanTransactionId(): string {
    return this.props.loanTransactionId;
  }

  get repaymentInstallmentId(): string {
    return this.props.repaymentInstallmentId;
  }

  get previousPrincipalPaid(): Money {
    return this.props.previousPrincipalPaid;
  }

  get previousInterestPaid(): Money {
    return this.props.previousInterestPaid;
  }

  get previousFeesPaid(): Money {
    return this.props.previousFeesPaid;
  }

  get previousPenaltyPaid(): Money {
    return this.props.previousPenaltyPaid;
  }

  get newPrincipalPaid(): Money {
    return this.props.newPrincipalPaid;
  }

  get newInterestPaid(): Money {
    return this.props.newInterestPaid;
  }

  get newFeesPaid(): Money {
    return this.props.newFeesPaid;
  }

  get newPenaltyPaid(): Money {
    return this.props.newPenaltyPaid;
  }

  get reason(): string {
    return this.props.reason;
  }

  get adjustedByUserId(): string {
    return this.props.adjustedByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
