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
});

describe('rejectLoanSchema', () => {
  it('accepts an empty body (reason is optional)', () => {
    expect(rejectLoanSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a reason string', () => {
    expect(rejectLoanSchema.safeParse({ reason: 'Insufficient documents' }).success).toBe(true);
  });
});
