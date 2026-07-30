import { describe, expect, it } from 'vitest';
import { ConcurrencyConflictError, DomainError } from '@shared/errors/DomainError';

describe('ConcurrencyConflictError', () => {
  it('is a DomainError with code CONCURRENCY_CONFLICT and httpStatus 409', () => {
    const error = new ConcurrencyConflictError('LoanAccount', 'loan-123');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ConcurrencyConflictError');
    expect(error.code).toBe('CONCURRENCY_CONFLICT');
    expect(error.httpStatus).toBe(409);
  });

  it('includes the entity name and id in the message', () => {
    const error = new ConcurrencyConflictError('RepaymentInstallment', 'installment-456');

    expect(error.message).toContain('RepaymentInstallment');
    expect(error.message).toContain('installment-456');
  });
});
