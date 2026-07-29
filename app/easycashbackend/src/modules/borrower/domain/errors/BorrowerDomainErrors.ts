import { DomainError } from '@shared/errors/DomainError';

export class InvalidPersonNameError extends DomainError {
  constructor(reason: string) {
    super('INVALID_PERSON_NAME', `Invalid person name: ${reason}`, undefined, 400);
    this.name = 'InvalidPersonNameError';
  }
}

/** 2026-07-14: `Borrower.sourceApplicationId` is `@unique` at the DB level (an approved
 * LoanApplication can only ever produce one Client Profile), but relying on that constraint alone
 * meant a duplicate attempt (e.g. a double-click, or two tabs open on the same application) fell
 * all the way to a raw Prisma P2002 and surfaced as a generic 500 - this gives it a clean, expected
 * error instead. `CreateBorrowerUseCase` checks proactively before insert. */
export class DuplicateClientProfileError extends DomainError {
  constructor(applicationId: string) {
    super(
      'DUPLICATE_CLIENT_PROFILE',
      `This loan application (${applicationId}) has already been converted into a client profile.`,
      undefined,
      409,
    );
    this.name = 'DuplicateClientProfileError';
  }
}
