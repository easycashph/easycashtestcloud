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
