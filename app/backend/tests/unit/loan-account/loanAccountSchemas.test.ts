import { describe, expect, it } from 'vitest';
import { createLoanAccountSchema, rejectLoanSchema } from '@modules/loan-account/interface/http/loanAccountSchemas';

describe('createLoanAccountSchema', () => {
  const base = {
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: '10000.00',
    interestRate: '2.5',
    installmentCount: 12,
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
