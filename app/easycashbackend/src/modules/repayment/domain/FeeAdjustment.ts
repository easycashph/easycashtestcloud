import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface FeeAdjustmentProps {
  id: string;
  repaymentInstallmentId: string;
  previousFeesAmount: Money;
  newFeesAmount: Money;
  reason: string;
  adjustedByUserId: string;
  createdAt: Date;
}

export interface CreateFeeAdjustmentProps {
  repaymentInstallmentId: string;
  previousFeesAmount: Money;
  newFeesAmount: Money;
  reason: string;
  adjustedByUserId: string;
}

/**
 * 2026-07-16 (Adjust Fees feature) — one immutable row per adjustment action, same posture as
 * `PenaltyReduction`: a historical record, never edited. Preserves full history even when the same
 * installment is adjusted more than once — `RepaymentInstallment.feesOverride` only tracks the
 * current/latest override, this is the append-only audit trail behind it. Bidirectional (unlike
 * `PenaltyReduction`, `newFeesAmount` may be higher OR lower than `previousFeesAmount`).
 */
export class FeeAdjustment {
  private constructor(private readonly props: FeeAdjustmentProps) {}

  static create(input: CreateFeeAdjustmentProps): FeeAdjustment {
    return new FeeAdjustment({
      id: randomUUID(),
      repaymentInstallmentId: input.repaymentInstallmentId,
      previousFeesAmount: input.previousFeesAmount,
      newFeesAmount: input.newFeesAmount,
      reason: input.reason,
      adjustedByUserId: input.adjustedByUserId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: FeeAdjustmentProps): FeeAdjustment {
    return new FeeAdjustment(props);
  }

  get id(): string {
    return this.props.id;
  }

  get repaymentInstallmentId(): string {
    return this.props.repaymentInstallmentId;
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

  get adjustedByUserId(): string {
    return this.props.adjustedByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
