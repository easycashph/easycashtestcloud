import { DomainError } from '@shared/errors/DomainError';

/**
 * Basic bookkeeping-integrity check, not a business-policy invention: a
 * transaction's principal/interest/fees/penalty components must sum to its
 * total amount. This is arithmetic correctness, independent of any
 * unresolved ADR (allocation order, rounding policy, etc.).
 */
export class ComponentSumMismatchError extends DomainError {
  constructor(amount: string, componentSum: string) {
    super(
      'COMPONENT_SUM_MISMATCH',
      `Transaction components sum to ${componentSum}, which does not match amount ${amount}.`,
      'TXN-2',
      400,
    );
    this.name = 'ComponentSumMismatchError';
  }
}
