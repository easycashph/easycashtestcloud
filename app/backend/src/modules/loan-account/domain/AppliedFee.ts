import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface AppliedFeeProps {
  id: string;
  feeRuleId: string;
  amount: Money;
  taxAmount: Money;
  appliedAt: Date;
  transactionId?: string;
}

export interface CreateAppliedFeeProps {
  feeRuleId: string;
  amount: Money;
  taxAmount?: Money;
  transactionId?: string;
}

/**
 * FEE-4: immutable once applied. Owned by LoanAccount (ADR-042 §5) — a
 * small, bounded collection (a handful per loan), unlike LoanTransaction.
 * No setters: an AppliedFee is created once and never edited, matching the
 * schema-level guarantee that editing a FeeRule later never changes a fee
 * already applied to a loan.
 */
export class AppliedFee {
  private constructor(private readonly props: AppliedFeeProps) {}

  static create(input: CreateAppliedFeeProps): AppliedFee {
    return new AppliedFee({
      id: randomUUID(),
      feeRuleId: input.feeRuleId,
      amount: input.amount,
      taxAmount: input.taxAmount ?? Money.ZERO,
      appliedAt: new Date(),
      transactionId: input.transactionId,
    });
  }

  static reconstitute(props: AppliedFeeProps): AppliedFee {
    return new AppliedFee(props);
  }

  get id(): string {
    return this.props.id;
  }

  get feeRuleId(): string {
    return this.props.feeRuleId;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get taxAmount(): Money {
    return this.props.taxAmount;
  }

  get appliedAt(): Date {
    return this.props.appliedAt;
  }

  get transactionId(): string | undefined {
    return this.props.transactionId;
  }
}
