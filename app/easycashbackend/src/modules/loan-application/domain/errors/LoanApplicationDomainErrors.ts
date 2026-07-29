import { DomainError } from '@shared/errors/DomainError';

/** Mirrors the mock UI's rule: an application must have a product sub-type assigned before it can be approved. */
export class ProductNotAssignedError extends DomainError {
  constructor() {
    super('PRODUCT_NOT_ASSIGNED', 'Cannot approve a loan application with no product sub-type assigned.', undefined, 400);
    this.name = 'ProductNotAssignedError';
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
