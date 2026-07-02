import { DomainError } from '@shared/errors/DomainError';

/**
 * Deliberately the SAME error for "unknown email" and "wrong password" —
 * Milestone 6 plan §4 (timing-attack / user-enumeration mitigation). Never
 * construct a more specific message for either case.
 */
export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid email or password.', undefined, 401);
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountInactiveError extends DomainError {
  constructor() {
    super('ACCOUNT_INACTIVE', 'This account is not active.', undefined, 403);
    this.name = 'AccountInactiveError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required.') {
    super('UNAUTHORIZED', message, undefined, 401);
    this.name = 'UnauthorizedError';
  }
}

export class TokenNotFoundError extends DomainError {
  constructor() {
    super('TOKEN_NOT_FOUND', 'Refresh token is invalid.', undefined, 401);
    this.name = 'TokenNotFoundError';
  }
}

export class TokenExpiredError extends DomainError {
  constructor() {
    super('TOKEN_EXPIRED', 'Refresh token has expired.', undefined, 401);
    this.name = 'TokenExpiredError';
  }
}

/**
 * TXN-adjacent security event, not a routine failure: an already-revoked
 * (rotated) refresh token was presented again. Milestone 6 plan §3/§8:
 * this triggers full-session-family revocation before the error is thrown.
 */
export class TokenReuseDetectedError extends DomainError {
  constructor() {
    super('TOKEN_REUSE_DETECTED', 'Refresh token reuse detected; all sessions revoked.', undefined, 401);
    this.name = 'TokenReuseDetectedError';
  }
}

export class UserInactiveError extends DomainError {
  constructor() {
    super('USER_INACTIVE', 'This account is no longer active.', undefined, 403);
    this.name = 'UserInactiveError';
  }
}

export class UserNotFoundError extends DomainError {
  constructor() {
    super('USER_NOT_FOUND', 'User not found.', undefined, 404);
    this.name = 'UserNotFoundError';
  }
}

/** Bootstrap-script-only errors — never flow through the HTTP errorHandler. */
export class AdminAlreadyExistsError extends DomainError {
  constructor() {
    super('ADMIN_ALREADY_EXISTS', 'An Administrator account already exists; refusing to bootstrap another.');
    this.name = 'AdminAlreadyExistsError';
  }
}

export class WeakPasswordError extends DomainError {
  constructor(violations: string[]) {
    super('WEAK_PASSWORD', `Password does not meet policy requirements: ${violations.join(', ')}`);
    this.name = 'WeakPasswordError';
  }
}
