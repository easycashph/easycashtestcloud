/**
 * Base class for business-rule violations. `ruleId` traces the failure
 * back to a specific Phase 1.5 invariant (e.g. "LA-3") or ADR, keeping the
 * API's error surface as traceable as the schema and specification.
 *
 * `httpStatus` defaults to 400 (bad request / business-rule violation).
 * Milestone 6 (Authentication) introduced 401/403 subclasses that need a
 * different status, so it's exposed here rather than hard-coded in
 * errorHandler — a small, backward-compatible extension of this
 * pre-existing base class.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly ruleId?: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} with id "${id}" was not found.`, undefined, 404);
    this.name = 'NotFoundError';
  }
}

/** Generic request-shape validation failure — used by `shared/middleware/validate.ts`. */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, undefined, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Milestone 8 / ADR-043: raised by `shared/middleware/requireRole.ts` when
 * an authenticated user's JWT `roles` claim doesn't include any role in a
 * route's allow-list. Distinct from `UnauthorizedError` (401, identity
 * module) — this is "you ARE who you say you are, but that role can't do
 * this," not "we don't know who you are."
 */
export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('FORBIDDEN', message, undefined, 403);
    this.name = 'ForbiddenError';
  }
}
