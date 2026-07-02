/**
 * Base class for business-rule violations. `ruleId` traces the failure
 * back to a specific Phase 1.5 invariant (e.g. "LA-3") or ADR, keeping the
 * API's error surface as traceable as the schema and specification.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly ruleId?: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} with id "${id}" was not found.`);
    this.name = 'NotFoundError';
  }
}
