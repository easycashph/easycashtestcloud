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

/** 2026-08-06 (Bind existing Client data to Portal) - a Borrower has no email on file, so a Portal
 * account can't be created/matched for them until staff adds one via the existing Edit flow. */
export class BorrowerMissingEmailError extends DomainError {
  constructor(borrowerId: string) {
    super('BORROWER_MISSING_EMAIL', `This client has no email address on file (${borrowerId}). Add one before creating a Portal account.`, undefined, 400);
    this.name = 'BorrowerMissingEmailError';
  }
}

/** 2026-08-06 (Bind existing Client data to Portal) - `PortalAccount.borrowerId` is `@unique`; a
 * Borrower can only ever have one linked Portal account at a time. */
export class BorrowerPortalAccountAlreadyLinkedError extends DomainError {
  constructor(borrowerId: string) {
    super('BORROWER_PORTAL_ACCOUNT_ALREADY_LINKED', `This client (${borrowerId}) already has a linked Portal account.`, undefined, 409);
    this.name = 'BorrowerPortalAccountAlreadyLinkedError';
  }
}

/** 2026-08-13 (user request) - staff "Reset Portal Password" action needs an existing linked
 * Portal account to reset; nothing to reset if this client was never given/never made one (use
 * "Create Portal Account" instead). */
export class BorrowerPortalAccountNotLinkedError extends DomainError {
  constructor(borrowerId: string) {
    super('BORROWER_PORTAL_ACCOUNT_NOT_LINKED', `This client (${borrowerId}) has no linked Portal account to reset.`, undefined, 404);
    this.name = 'BorrowerPortalAccountNotLinkedError';
  }
}
