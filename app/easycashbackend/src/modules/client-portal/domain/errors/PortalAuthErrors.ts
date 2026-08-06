import { DomainError } from '@shared/errors/DomainError';

/** Deliberately the SAME error for "unknown email" and "wrong password" - same enumeration-
 * avoidance posture as identity/InvalidCredentialsError. */
export class PortalInvalidCredentialsError extends DomainError {
  constructor() {
    super('PORTAL_INVALID_CREDENTIALS', 'Invalid email or password.', undefined, 401);
    this.name = 'PortalInvalidCredentialsError';
  }
}

export class PortalEmailAlreadyInUseError extends DomainError {
  constructor() {
    super('PORTAL_EMAIL_ALREADY_IN_USE', 'An account with this email already exists.', undefined, 409);
    this.name = 'PortalEmailAlreadyInUseError';
  }
}

export class PortalAccountNotVerifiedError extends DomainError {
  constructor() {
    super('PORTAL_ACCOUNT_NOT_VERIFIED', 'Please verify your email before signing in.', undefined, 403);
    this.name = 'PortalAccountNotVerifiedError';
  }
}

/** Same "wrong code / expired / already used" unified error as identity's InvalidOtpError - never
 * lets a caller distinguish which one occurred. */
export class PortalInvalidOtpError extends DomainError {
  constructor() {
    super('PORTAL_INVALID_OTP', 'That code is incorrect or has expired.', undefined, 401);
    this.name = 'PortalInvalidOtpError';
  }
}

export class PortalTooManyOtpAttemptsError extends DomainError {
  constructor() {
    super('PORTAL_TOO_MANY_OTP_ATTEMPTS', 'Too many incorrect attempts. Request a new code.', undefined, 429);
    this.name = 'PortalTooManyOtpAttemptsError';
  }
}

export class PortalAccountNotFoundError extends DomainError {
  constructor() {
    super('PORTAL_ACCOUNT_NOT_FOUND', 'Account not found.', undefined, 404);
    this.name = 'PortalAccountNotFoundError';
  }
}

/** Login 2FA (2026-07-30) - chosen channel is SMS but the account has no contactNumber on file. */
export class PortalTwoFactorChannelUnavailableError extends DomainError {
  constructor(channel: string) {
    super('PORTAL_2FA_CHANNEL_UNAVAILABLE', `Cannot send a code via ${channel} - no destination on file.`, undefined, 422);
    this.name = 'PortalTwoFactorChannelUnavailableError';
  }
}

export class PortalWeakPasswordError extends DomainError {
  constructor(violations: string[]) {
    super('PORTAL_WEAK_PASSWORD', `Password does not meet policy requirements: ${violations.join(', ')}`, undefined, 422);
    this.name = 'PortalWeakPasswordError';
  }
}

/** Same shape whether the application truly doesn't exist or simply belongs to a different
 * account - never lets a caller probe for other clients' application IDs. */
export class PortalLoanApplicationNotFoundError extends DomainError {
  constructor() {
    super('PORTAL_LOAN_APPLICATION_NOT_FOUND', 'Loan application not found.', undefined, 404);
    this.name = 'PortalLoanApplicationNotFoundError';
  }
}

/** Same "same shape either way" reasoning as PortalLoanApplicationNotFoundError, for the payment
 * history / amortization schedule view (2026-07-31 user request) - a loan account that doesn't
 * exist, or belongs to a different client's Borrower record, is indistinguishable to the caller. */
export class PortalLoanAccountNotFoundError extends DomainError {
  constructor() {
    super('PORTAL_LOAN_ACCOUNT_NOT_FOUND', 'Loan account not found.', undefined, 404);
    this.name = 'PortalLoanAccountNotFoundError';
  }
}

/** 2026-08-06 (Bind existing Client data to Portal) - the on-demand staff "Bind Existing Portal
 * Account" action found a PortalAccount matching the client's email, but it's already linked to a
 * DIFFERENT Borrower - binding it here would silently steal it from whoever it actually belongs to. */
export class PortalAccountAlreadyLinkedError extends DomainError {
  constructor() {
    super('PORTAL_ACCOUNT_ALREADY_LINKED', 'This Portal account is already linked to a different client.', undefined, 409);
    this.name = 'PortalAccountAlreadyLinkedError';
  }
}

