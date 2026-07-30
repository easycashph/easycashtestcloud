import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface PaymentAllocationProps {
  id: string;
  loanTransactionId: string;
  repaymentInstallmentId: string;
  principalApplied: Money;
  interestApplied: Money;
  feesApplied: Money;
  penaltyApplied: Money;
  createdAt: Date;
}

export interface CreatePaymentAllocationProps {
  loanTransactionId: string;
  repaymentInstallmentId: string;
  principalApplied: Money;
  interestApplied: Money;
  feesApplied: Money;
  penaltyApplied: Money;
}

/**
 * 2026-07-11 (Reverse Payment feature) — one row per (transaction, installment) pair a REPAYMENT
 * transaction affected, with the exact per-component amounts applied. See the Prisma schema's own
 * doc comment on the `PaymentAllocation` model for the full rationale (why `LoanTransaction`'s
 * aggregate components alone aren't enough to safely reverse a specific past payment).
 *
 * Immutable once created — like `AppliedFee`, this is a historical record, never edited. A
 * reversal doesn't mutate or delete these rows; it reads them, then writes its own effects
 * elsewhere (`RepaymentInstallment.recordPayment()`, `LoanAccount.applyPayment()`, a new
 * `REVERSAL` `LoanTransaction`).
 */
export class PaymentAllocation {
  private constructor(private readonly props: PaymentAllocationProps) {}

  static create(input: CreatePaymentAllocationProps): PaymentAllocation {
    return new PaymentAllocation({
      id: randomUUID(),
      loanTransactionId: input.loanTransactionId,
      repaymentInstallmentId: input.repaymentInstallmentId,
      principalApplied: input.principalApplied,
      interestApplied: input.interestApplied,
      feesApplied: input.feesApplied,
      penaltyApplied: input.penaltyApplied,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: PaymentAllocationProps): PaymentAllocation {
    return new PaymentAllocation(props);
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

  get principalApplied(): Money {
    return this.props.principalApplied;
  }

  get interestApplied(): Money {
    return this.props.interestApplied;
  }

  get feesApplied(): Money {
    return this.props.feesApplied;
  }

  get penaltyApplied(): Money {
    return this.props.penaltyApplied;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
