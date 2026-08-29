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
 * 2026-08-20 (user-confirmed, "pwede i pasok ng mataas or mababa hindi lang pababa"): staff may
 * negotiate the new loan's principal/interest rate to ANY value, above or below the system-computed
 * figure (unpaid principal+interest+penalty+accrued interest+fees / the old loan's own rate) - same
 * "ceiling removed, real out-of-band approval" precedent as Reduce Penalty/Adjust Fees. Unlike those
 * two, though, a restructure moves a large, one-time principal figure, so a `reason` is required
 * (not merely optional) whenever the actual figure used differs from the computed default in either
 * direction - the audit trail must say why, not just that it happened.
 */
export class NegotiatedOverrideReasonRequiredError extends DomainError {
  constructor(field: 'principal' | 'interest rate') {
    super(
      'NEGOTIATED_OVERRIDE_REASON_REQUIRED',
      `A reason is required when the negotiated ${field} differs from the computed default.`,
      undefined,
      400,
    );
    this.name = 'NegotiatedOverrideReasonRequiredError';
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
 * 2026-08-07 (Undo Restructure / Undo Adjustment feature, user-confirmed, same "safety net for an
 * accidental/premature action, not a general-purpose unwind" posture as `LoanAccountHasActivityError`
 * - a distinct class rather than reusing that one outright, since its message hardcodes "undo
 * activation" wording that wouldn't fit this case): refuses to undo once the NEW loan the
 * restructure/adjustment created already has a recorded REPAYMENT, or a Reduce Penalty/Adjust Fees
 * override on any of its installments.
 */
export class NewLoanAccountHasActivityError extends DomainError {
  constructor(newLoanAccountId: string, reason: string) {
    super('NEW_LOAN_ACCOUNT_HAS_ACTIVITY', `Cannot undo: the new LoanAccount ${newLoanAccountId} ${reason}.`, undefined, 400);
    this.name = 'NewLoanAccountHasActivityError';
  }
}

/**
 * 2026-08-08 (Undo Restructure / Undo Adjustment feature): thrown when a loan account has never
 * been restructured/adjusted at all (nothing to undo) - also what a double-undo attempt hits,
 * since the first undo deletes the `LoanRestructure`/`LoanAdjustment` row outright.
 */
export class LoanNotRestructuredError extends DomainError {
  constructor(loanAccountId: string) {
    super('LOAN_NOT_RESTRUCTURED', `LoanAccount ${loanAccountId} has not been restructured.`, undefined, 404);
    this.name = 'LoanNotRestructuredError';
  }
}

/** Same as `LoanNotRestructuredError`, for adjustment. */
export class LoanNotAdjustedError extends DomainError {
  constructor(loanAccountId: string) {
    super('LOAN_NOT_ADJUSTED', `LoanAccount ${loanAccountId} has not been adjusted.`, undefined, 404);
    this.name = 'LoanNotAdjustedError';
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

/**
 * 2026-08-29 (Compromise Settlement feature, user-confirmed): only an ACTIVE/ACTIVE_IN_ARREARS
 * loan may be folded into a settlement - same base eligibility as Restructure, but WITHOUT
 * Restructure's additional "must be past due or matured" requirement (a compromise is a
 * negotiated write-down agreed with the borrower, not necessarily triggered by delinquency).
 */
export class LoanNotEligibleForCompromiseSettlementError extends DomainError {
  constructor(loanAccountId: string, reason: string) {
    super(
      'LOAN_NOT_ELIGIBLE_FOR_COMPROMISE_SETTLEMENT',
      `LoanAccount ${loanAccountId} is not eligible for a compromise settlement: ${reason}.`,
      undefined,
      400,
    );
    this.name = 'LoanNotEligibleForCompromiseSettlementError';
  }
}

/**
 * 2026-08-29 (Compromise Settlement feature, user-confirmed): "isang beses lang" - same
 * one-time-only posture as LoanAlreadyRestructuredError, enforced both here (fast pre-transaction
 * check) and by LoanCompromiseSettlementItem.oldLoanAccountId's unique constraint.
 */
export class LoanAlreadyInCompromiseSettlementError extends DomainError {
  constructor(loanAccountId: string) {
    super(
      'LOAN_ALREADY_IN_COMPROMISE_SETTLEMENT',
      `LoanAccount ${loanAccountId} has already been folded into a compromise settlement once.`,
      undefined,
      409,
    );
    this.name = 'LoanAlreadyInCompromiseSettlementError';
  }
}

/**
 * 2026-08-29 (Compromise Settlement feature, user-confirmed): the new consolidated loan has ONE
 * borrower - every old loan folded into it must belong to that same borrower, otherwise the new
 * loan's principal would represent a debt that isn't really theirs.
 */
export class CompromiseSettlementRequiresSameBorrowerError extends DomainError {
  constructor() {
    super(
      'COMPROMISE_SETTLEMENT_REQUIRES_SAME_BORROWER',
      'All loan accounts folded into a compromise settlement must belong to the same borrower.',
      undefined,
      400,
    );
    this.name = 'CompromiseSettlementRequiresSameBorrowerError';
  }
}
