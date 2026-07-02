import { DomainError } from '@shared/errors/DomainError';

/**
 * LA-2 / ADR-011: the LoanAccountStatus lifecycle is a lean, legacy-observed
 * state set. This error guards every transition against the allowed-moves
 * table in LoanAccount.ts — the entity is the single place that decides
 * what a legal transition is, never a use case.
 */
export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_STATUS_TRANSITION', `Cannot transition LoanAccount from ${from} to ${to}.`, 'LA-2', 400);
    this.name = 'InvalidStatusTransitionError';
  }
}
