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
    super('ADMIN_ALREADY_EXISTS', 'An MIS account already exists; refusing to bootstrap another.');
    this.name = 'AdminAlreadyExistsError';
  }
}

export class WeakPasswordError extends DomainError {
  constructor(violations: string[]) {
    super('WEAK_PASSWORD', `Password does not meet policy requirements: ${violations.join(', ')}`);
    this.name = 'WeakPasswordError';
  }
}

/**
 * Audit finding H-03: thrown by PrismaUserRepository.create() when one or
 * more requested role names don't resolve to an existing Role row — e.g.
 * the seed hasn't run, or a name is misspelled. Previously this failed
 * silently, creating a user with fewer (or zero) roles than requested,
 * which is especially dangerous on the bootstrap-admin path. 500 because
 * this reflects a server-side data/configuration problem (missing seed
 * data), not a client input mistake.
 */
export class EmailAlreadyInUseError extends DomainError {
  constructor(email: string) {
    super('EMAIL_ALREADY_IN_USE', `A user with email "${email}" already exists.`, undefined, 409);
    this.name = 'EmailAlreadyInUseError';
  }
}

export class RoleNotFoundError extends DomainError {
  constructor(missingRoleNames: string[]) {
    super(
      'ROLE_NOT_FOUND',
      `The following roles do not exist and could not be assigned: ${missingRoleNames.join(', ')}. Has "prisma db seed" been run?`,
      undefined,
      500,
    );
    this.name = 'RoleNotFoundError';
  }
}
