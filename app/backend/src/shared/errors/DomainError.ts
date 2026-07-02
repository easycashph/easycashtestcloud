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
