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

export class PortalWeakPasswordError extends DomainError {
  constructor(violations: string[]) {
    super('PORTAL_WEAK_PASSWORD', `Password does not meet policy requirements: ${violations.join(', ')}`, undefined, 422);
    this.name = 'PortalWeakPasswordError';
  }
}
