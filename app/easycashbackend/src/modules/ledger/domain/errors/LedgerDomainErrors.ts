import { DomainError } from '@shared/errors/DomainError';

/**
 * Basic bookkeeping-integrity check, not a business-policy invention: a
 * transaction's principal/interest/fees/penalty components must sum to its
 * total amount. This is arithmetic correctness, independent of any
 * unresolved ADR (allocation order, rounding policy, etc.).
 */
export class ComponentSumMismatchError extends DomainError {
  constructor(amount: string, componentSum: string) {
    super(
      'COMPONENT_SUM_MISMATCH',
      `Transaction components sum to ${componentSum}, which does not match amount ${amount}.`,
      'TXN-2',
      400,
    );
    this.name = 'ComponentSumMismatchError';
  }
}

/**
 * 2026-07-11 (Reverse Payment feature): only a REPAYMENT transaction can be reversed through this
 * flow — DISBURSEMENT/ADJUSTMENT/etc. corrections are a separate, not-yet-built concern
 * (`CALCULATION_ENGINE_SPEC.md` §10, still UNRESOLVED), and a REVERSAL transaction reversing
 * another REVERSAL is nonsensical (the original REPAYMENT is the only thing being corrected).
 */
export class TransactionNotReversibleError extends DomainError {
  constructor(transactionType: string) {
    super(
      'TRANSACTION_NOT_REVERSIBLE',
      `Only a REPAYMENT transaction can be reversed through this flow — this transaction is type ${transactionType}.`,
      undefined,
      400,
    );
    this.name = 'TransactionNotReversibleError';
  }
}

/** TXN-1: a transaction may be reversed at most once — the schema's own `reversesTransactionId @unique` enforces this at the DB level too; this is the clean application-level rejection before that constraint would fire. */
export class TransactionAlreadyReversedError extends DomainError {
  constructor(transactionId: string) {
    super('TRANSACTION_ALREADY_REVERSED', `Transaction ${transactionId} has already been reversed.`, undefined, 409);
    this.name = 'TransactionAlreadyReversedError';
  }
}

/**
 * A REPAYMENT transaction recorded before the Reverse Payment feature existed has no
 * `PaymentAllocation` breakdown (see that entity's own doc comment — written going forward only,
 * not backfilled). Reversing it precisely (per-installment) isn't possible without that
 * breakdown, and reversing only the loan-level aggregate would leave the per-installment
 * `paid`/status figures inconsistent with the loan's own balances — refused rather than risking
 * that mismatch. The older manual-ADJUSTMENT-transaction workaround remains available for these.
 */
export class NoReversibleAllocationDataError extends DomainError {
  constructor(transactionId: string) {
    super(
      'NO_REVERSIBLE_ALLOCATION_DATA',
      `Transaction ${transactionId} predates the Reverse Payment feature and has no recorded per-installment breakdown — it cannot be reversed through this flow. Use a manual adjustment instead.`,
      undefined,
      409,
    );
    this.name = 'NoReversibleAllocationDataError';
  }
}

/**
 * 2026-08-14 (Manual Payment Adjustment feature): the mirror-image guard of
 * `NoReversibleAllocationDataError` above — this tool exists specifically for transactions Reverse
 * Payment refuses to touch. A transaction that DOES have `PaymentAllocation` rows should go through
 * the precise, automatic Reverse Payment flow instead; allowing both paths on the same transaction
 * would let staff bypass Reverse Payment's exact per-installment undo with a manually-typed guess.
 */
export class TransactionHasAllocationDataError extends DomainError {
  constructor(transactionId: string) {
    super(
      'TRANSACTION_HAS_ALLOCATION_DATA',
      `Transaction ${transactionId} has a recorded per-installment breakdown — use Reverse Payment instead, which can undo it precisely.`,
      undefined,
      409,
    );
    this.name = 'TransactionHasAllocationDataError';
  }
}

/**
 * 2026-08-14 (Manual Payment Adjustment feature): a staff-entered reduction can't take an
 * installment's recorded `paid` amount for a component below zero — unlike Reverse Payment (which
 * only ever replays exact previously-applied amounts, so this can never happen there), a manual
 * adjustment is a human-typed guess and needs its own guard.
 */
export class PaymentAdjustmentExceedsPaidAmountError extends DomainError {
  constructor(installmentId: string, component: string) {
    super(
      'PAYMENT_ADJUSTMENT_EXCEEDS_PAID_AMOUNT',
      `Cannot reduce ${component} on installment ${installmentId} by more than what is currently recorded as paid.`,
      undefined,
      400,
    );
    this.name = 'PaymentAdjustmentExceedsPaidAmountError';
  }
}

/** A manual adjustment must actually change something — at least one non-zero component delta across all installments. */
export class EmptyPaymentAdjustmentError extends DomainError {
  constructor() {
    super('EMPTY_PAYMENT_ADJUSTMENT', 'At least one non-zero amount must be adjusted.', undefined, 400);
    this.name = 'EmptyPaymentAdjustmentError';
  }
}
