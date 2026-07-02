import { DomainError } from '@shared/errors/DomainError';

/**
 * LA-2 / ADR-011: the LoanAccountStatus lifecycle is a lean, legacy-observed
 * state set. This error guards every transition against the allowed-moves
 * table in LoanAccount.ts — the entity is the single place that decides
 * what a legal transition is, never a use case.
 */
export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_STATUS_TRANSITION', `Cannot transition LoanAccount from ${from} to ${to}.`, 'LA-2', 400);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * Milestone 8 / D-3: configuration validation, not financial calculation
 * — the loan's requested principal must fall within its LoanProductVersion's
 * configured `loanAmountMin`/`loanAmountMax`. No interest/amortization math
 * is involved.
 */
export class LoanAmountOutOfRangeError extends DomainError {
  constructor(requested: string, min: string, max?: string) {
    const rangeDescription = max ? `between ${min} and ${max}` : `at least ${min}`;
    super(
      'LOAN_AMOUNT_OUT_OF_RANGE',
      `Requested principal amount ${requested} is outside the product version's configured range (${rangeDescription}).`,
      undefined,
      400,
    );
    this.name = 'LoanAmountOutOfRangeError';
  }
}

/** Milestone 8 / D-3: same as LoanAmountOutOfRangeError, for installmentCount. */
export class InstallmentCountOutOfRangeError extends DomainError {
  constructor(requested: number, min: number, max?: number) {
    const rangeDescription = max ? `between ${min} and ${max}` : `at least ${min}`;
    super(
      'INSTALLMENT_COUNT_OUT_OF_RANGE',
      `Requested installment count ${requested} is outside the product version's configured range (${rangeDescription}).`,
      undefined,
      400,
    );
    this.name = 'InstallmentCountOutOfRangeError';
  }
}
