import { DomainError } from '@shared/errors/DomainError';

/**
 * LA-2 / ADR-011: the LoanAccountStatus lifecycle is a lean, legacy-observed
 * state set. This error guards every transition against the allowed-moves
 * table in LoanAccount.ts - the entity is the single place that decides
 * what a legal transition is, never a use case.
 */
export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_STATUS_TRANSITION', `Cannot transition LoanAccount from ${from} to ${to}.`, 'LA-2', 400);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * 2026-07-16 (Edit Loan Account, user request): "may kailangan baguhin katulad ng term or amount,
 * dapat pwede ko ito i-edit hangga't before ma-approve" — mirrors LA-4's "immutable once approved"
 * precedent already used everywhere else in this codebase (loan product versions, penalty/fee
 * snapshots): a PENDING_APPROVAL loan account has disbursed nothing and posted no ledger entries
 * yet, so its origination fields are still safe to change; once APPROVED (or later), the
 * risk-assessment/documents/schedule preview a reviewer already looked at could silently drift
 * from what gets activated, so editing is refused outright rather than allowed-then-reconciled.
 */
export class LoanAccountNotEditableError extends DomainError {
  constructor(status: string) {
    super(
      'LOAN_ACCOUNT_NOT_EDITABLE',
      `Cannot edit a LoanAccount once it is past PENDING_APPROVAL (current status: ${status}).`,
      'LA-4',
      400,
    );
    this.name = 'LoanAccountNotEditableError';
  }
}

/**
 * 2026-07-16 (Undo Activate, user request, MIS-only): guards against undoing an activation that
 * already has real financial activity attached — a recorded REPAYMENT, or a Reduce Penalty/Adjust
 * Fees override on any installment. Deliberately scoped this narrow (user-confirmed): "Undo
 * Activate" exists for the "clicked Activate by mistake, nothing else has happened yet" case, not
 * as a general-purpose way to unwind an active loan with real activity on it.
 */
export class LoanAccountHasActivityError extends DomainError {
  constructor(loanAccountId: string, reason: string) {
    super(
      'LOAN_ACCOUNT_HAS_ACTIVITY',
      `Cannot undo activation of LoanAccount ${loanAccountId}: ${reason}.`,
      undefined,
      400,
    );
    this.name = 'LoanAccountHasActivityError';
  }
}

/**
 * Milestone 8 / D-3: configuration validation, not financial calculation
 * - the loan's requested principal must fall within its LoanProductVersion's
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

/**
 * 2026-07-24 (Loan Restructure feature, user-confirmed): only ACTIVE/ACTIVE_IN_ARREARS loans that
 * are currently past due or matured are eligible - "Ino offer lang ito sa mga past due at matured
 * account." A current/good-standing loan, or one in any other status (PENDING_APPROVAL/APPROVED/
 * already-CLOSED*), is refused.
 */
export class LoanNotEligibleForRestructureError extends DomainError {
  constructor(loanAccountId: string, reason: string) {
    super('LOAN_NOT_ELIGIBLE_FOR_RESTRUCTURE', `LoanAccount ${loanAccountId} is not eligible for restructure: ${reason}.`, undefined, 400);
    this.name = 'LoanNotEligibleForRestructureError';
  }
}

/**
 * 2026-07-24 (Loan Restructure feature, user-confirmed): "isang beses lang pwede gawin per loan
 * account" - a specific LoanAccount may be the OLD side of at most one restructure ever. Enforced
 * both here (fast, pre-transaction check) and by the `LoanRestructure.oldLoanAccountId` unique
 * constraint (the real guarantee under concurrent requests).
 */
export class LoanAlreadyRestructuredError extends DomainError {
  constructor(loanAccountId: string) {
    super('LOAN_ALREADY_RESTRUCTURED', `LoanAccount ${loanAccountId} has already been restructured once.`, undefined, 409);
    this.name = 'LoanAlreadyRestructuredError';
  }
}

/**
 * 2026-07-24 (Loan Adjustment feature, user-confirmed): "ina apply sa mga wala pang bayad na
 * account... kailangan before ng 1st due date lang pwede i Loan Adjust ang account" - only an
 * ACTIVE loan with zero payments recorded on ANY installment, and only before its first
 * installment's own due date, is eligible. A loan with even one payment, or one whose first
 * installment has already come due, is refused.
 */
export class LoanNotEligibleForAdjustmentError extends DomainError {
  constructor(loanAccountId: string, reason: string) {
    super('LOAN_NOT_ELIGIBLE_FOR_ADJUSTMENT', `LoanAccount ${loanAccountId} is not eligible for adjustment: ${reason}.`, undefined, 400);
    this.name = 'LoanNotEligibleForAdjustmentError';
  }
}

/**
 * 2026-07-24 (Loan Adjustment feature, user-confirmed): same "exactly once" posture as
 * `LoanAlreadyRestructuredError` - a specific LoanAccount may be the OLD side of at most one
 * adjustment ever.
 */
export class LoanAlreadyAdjustedError extends DomainError {
  constructor(loanAccountId: string) {
    super('LOAN_ALREADY_ADJUSTED', `LoanAccount ${loanAccountId} has already been adjusted once.`, undefined, 409);
    this.name = 'LoanAlreadyAdjustedError';
  }
}

/**
 * Milestone 9.1 checkpoint 8 / `CALCULATION_ENGINE_SPEC.md` §4: only
 * `DECLINING_BALANCE`/`DECLINING_BALANCE_DISCOUNTED` are `STATUS: CONFIRMED`
 * and implemented (`AmortizationScheduleGenerator`, CP3) - both are
 * calculation-identical per `ADR-010` §5. `FLAT` has no evidenced formula
 * anywhere in this project's evidence base and is explicitly
 * `STATUS: UNRESOLVED`; `ActivateLoanUseCase` must refuse to activate a
 * loan whose `LoanProductVersion.interestCalculationMethod` is `FLAT`
 * rather than silently applying the declining-balance formula to it.
 */
export class UnsupportedInterestCalculationMethodError extends DomainError {
  constructor(method: string) {
    super(
      'UNSUPPORTED_INTEREST_CALCULATION_METHOD',
      `Cannot activate a loan whose LoanProductVersion uses interestCalculationMethod "${method}" - only DECLINING_BALANCE/DECLINING_BALANCE_DISCOUNTED are implemented (CALCULATION_ENGINE_SPEC.md §4 UNRESOLVED for FLAT).`,
      undefined,
      400,
    );
    this.name = 'UnsupportedInterestCalculationMethodError';
  }
}
