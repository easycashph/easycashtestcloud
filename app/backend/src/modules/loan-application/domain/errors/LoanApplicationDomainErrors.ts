import { DomainError } from '@shared/errors/DomainError';

/** Mirrors the mock UI's rule: an application must have a product sub-type assigned before it can be approved. */
export class ProductNotAssignedError extends DomainError {
  constructor() {
    super('PRODUCT_NOT_ASSIGNED', 'Cannot approve a loan application with no product sub-type assigned.', undefined, 400);
    this.name = 'ProductNotAssignedError';
  }
}

/** 2026-07-21 — Seafarer Loan applications must have the Agency/Contract/Allotment verification
 * section of the Review Report filled in (at minimum: agency name, position, vessel) before they
 * can be tagged Pre Approval - mirrors the legacy CER template's requirement for that product line. */
export class MissingAgencyVerificationError extends DomainError {
  constructor() {
    super(
      'MISSING_AGENCY_VERIFICATION',
      'Complete the Agency/Contract/Allotment verification section of the Review Report before tagging a Seafarer Loan application as Pre Approval.',
      undefined,
      400,
    );
    this.name = 'MissingAgencyVerificationError';
  }
}

/** Thrown when approve/decline/revert is attempted from a status that doesn't allow it. */
export class InvalidLoanApplicationTransitionError extends DomainError {
  constructor(from: string, action: string) {
    super('INVALID_LOAN_APPLICATION_TRANSITION', `Cannot ${action} a loan application currently in status "${from}".`, undefined, 400);
    this.name = 'InvalidLoanApplicationTransitionError';
  }
}

/** 2026-07-14: a client cannot have two loan applications "in flight" at once, nor start a new
 * one while a prior loan (from an earlier application) is still open - see
 * `CreateLoanApplicationUseCase`'s own doc comment for the exact rule. */
export class BorrowerHasInFlightLoanError extends DomainError {
  constructor(reason: 'PENDING_APPLICATION' | 'ACTIVE_LOAN') {
    const message =
      reason === 'PENDING_APPLICATION'
        ? 'This client already has a loan application that has not been decided or converted yet.'
        : 'This client still has an active (not-yet-closed) loan account.';
    super('BORROWER_HAS_IN_FLIGHT_LOAN', message, undefined, 409);
    this.name = 'BorrowerHasInFlightLoanError';
  }
}
