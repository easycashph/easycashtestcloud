import { DomainError } from '@shared/errors/DomainError';

/**
 * LPV-2 (Hard Rule): thrown when an operation would leave a LoanProduct
 * with zero or more than one Active version, or targets a version that
 * doesn't belong to this product. Enforced here (application-layer
 * boundary of the LoanProduct aggregate) in addition to the database's
 * partial unique index backstop — see ADR-042 §4.
 */
export class InvalidVersionActivationError extends DomainError {
  constructor(reason: string) {
    super('INVALID_VERSION_ACTIVATION', `Cannot activate loan product version: ${reason}`, 'LPV-2', 400);
    this.name = 'InvalidVersionActivationError';
  }
}

export class DuplicateVersionNumberError extends DomainError {
  constructor(versionNumber: number) {
    super(
      'DUPLICATE_VERSION_NUMBER',
      `Version number ${versionNumber} already exists for this loan product.`,
      undefined,
      400,
    );
    this.name = 'DuplicateVersionNumberError';
  }
}
