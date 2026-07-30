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
