import { describe, expect, it } from 'vitest';
import { createLoanAccountSchema, processPaymentSchema, rejectLoanSchema } from '@modules/loan-account/interface/http/loanAccountSchemas';

describe('createLoanAccountSchema', () => {
  const base = {
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: '10000.00',
    interestRate: '2.5',
    installmentCount: 12,
    firstRepaymentDate: '2026-08-15',
  };

  it('accepts a minimal valid payload', () => {
    expect(createLoanAccountSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a missing principalAmount', () => {
    const { principalAmount: _principalAmount, ...withoutPrincipal } = base;
    expect(createLoanAccountSchema.safeParse(withoutPrincipal).success).toBe(false);
  });

  it('rejects a non-positive installmentCount', () => {
    expect(createLoanAccountSchema.safeParse({ ...base, installmentCount: 0 }).success).toBe(false);
  });

  // ADR-045 (Concept 1 — Exact First Repayment Date): required, explicit input, never derived.
  it('rejects a missing firstRepaymentDate', () => {
    const { firstRepaymentDate: _firstRepaymentDate, ...withoutFirstRepaymentDate } = base;
    expect(createLoanAccountSchema.safeParse(withoutFirstRepaymentDate).success).toBe(false);
  });

  // Milestone 8.1 remediation (audit finding H-2): previously only
  // required a non-empty string, so a malformed value like "abc" reached
  // Money.of()/Percentage.of() and threw an unhandled decimal.js parse
  // error (a raw Error, not a DomainError) — surfacing as an opaque 500
  // instead of a clean 400. These prove the Zod boundary now rejects it.
  describe('decimal field format validation (H-2)', () => {
    it('rejects a non-numeric principalAmount', () => {
      const result = createLoanAccountSchema.safeParse({ ...base, principalAmount: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejects a non-numeric interestRate', () => {
      const result = createLoanAccountSchema.safeParse({ ...base, interestRate: 'not-a-number' });
      expect(result.success).toBe(false);
    });

    it('rejects a non-numeric addOnInterestRate / contractualInterestRate', () => {
      expect(createLoanAccountSchema.safeParse({ ...base, addOnInterestRate: 'abc' }).success).toBe(false);
      expect(createLoanAccountSchema.safeParse({ ...base, contractualInterestRate: 'abc' }).success).toBe(false);
    });

    it('accepts well-formed decimal strings for every decimal field', () => {
      const result = createLoanAccountSchema.safeParse({
        ...base,
        principalAmount: '10000.00',
        interestRate: '2.5',
        addOnInterestRate: '1.25',
        contractualInterestRate: '3.75',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('rejectLoanSchema', () => {
  it('accepts an empty body (reason is optional)', () => {
    expect(rejectLoanSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a reason string', () => {
    expect(rejectLoanSchema.safeParse({ reason: 'Insufficient documents' }).success).toBe(true);
  });
});

describe('processPaymentSchema', () => {
  it('accepts a body missing orNumber (2026-07-11 follow-up: OR# is not always issued yet — AR# may be the only receipt number available at payment time)', () => {
    const result = processPaymentSchema.safeParse({ paymentAmount: '500.00' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty-string orNumber (omit it entirely instead)', () => {
    const result = processPaymentSchema.safeParse({ paymentAmount: '500.00', orNumber: '' });
    expect(result.success).toBe(false);
  });

  it('accepts orNumber alone, arNumber omitted (not every channel issues an AR)', () => {
    const result = processPaymentSchema.safeParse({ paymentAmount: '500.00', orNumber: 'OR-1001' });
    expect(result.success).toBe(true);
  });

  it('accepts arNumber alone, orNumber omitted (OR# not yet issued)', () => {
    const result = processPaymentSchema.safeParse({ paymentAmount: '500.00', arNumber: 'AR-2002' });
    expect(result.success).toBe(true);
  });

  it('accepts both orNumber and arNumber', () => {
    const result = processPaymentSchema.safeParse({ paymentAmount: '500.00', orNumber: 'OR-1001', arNumber: 'AR-2002' });
    expect(result.success).toBe(true);
  });
});
