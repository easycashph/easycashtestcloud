import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface PenaltyReductionProps {
  id: string;
  repaymentInstallmentId: string;
  previousPenaltyAmount: Money;
  newPenaltyAmount: Money;
  reason: string;
  reducedByUserId: string;
  createdAt: Date;
}

export interface CreatePenaltyReductionProps {
  repaymentInstallmentId: string;
  previousPenaltyAmount: Money;
  newPenaltyAmount: Money;
  reason: string;
  reducedByUserId: string;
}

/**
 * 2026-07-15 (Reduce Penalty feature) — one immutable row per reduction action, same posture as
 * `PaymentAllocation`/`AppliedFee`: a historical record, never edited. Preserves full history even
 * when the same installment is reduced more than once — `RepaymentInstallment.penaltyOverride`
 * only tracks the current/latest override, this is the append-only audit trail behind it.
 */
export class PenaltyReduction {
  private constructor(private readonly props: PenaltyReductionProps) {}

  static create(input: CreatePenaltyReductionProps): PenaltyReduction {
    return new PenaltyReduction({
      id: randomUUID(),
      repaymentInstallmentId: input.repaymentInstallmentId,
      previousPenaltyAmount: input.previousPenaltyAmount,
      newPenaltyAmount: input.newPenaltyAmount,
      reason: input.reason,
      reducedByUserId: input.reducedByUserId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: PenaltyReductionProps): PenaltyReduction {
    return new PenaltyReduction(props);
  }

  get id(): string {
    return this.props.id;
  }

  get repaymentInstallmentId(): string {
    return this.props.repaymentInstallmentId;
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

  get reducedByUserId(): string {
    return this.props.reducedByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
