import { describe, expect, it } from 'vitest';
import { createLoanProductSchema, createLoanProductVersionSchema } from '@modules/loan-product/interface/http/loanProductSchemas';

describe('createLoanProductSchema', () => {
  it('accepts a minimal valid payload', () => {
    expect(createLoanProductSchema.safeParse({ code: 'PL-01', name: 'Personal Loan' }).success).toBe(true);
  });

  it('rejects a missing code', () => {
    expect(createLoanProductSchema.safeParse({ name: 'Personal Loan' }).success).toBe(false);
  });
});

describe('createLoanProductVersionSchema', () => {
  const base = {
    versionNumber: 1,
    effectiveFrom: '2026-01-01',
    interestCalculationMethod: 'FLAT',
    loanAmountMin: '1000.00',
    installmentCountMin: 6,
  };

  it('accepts a minimal valid payload', () => {
    expect(createLoanProductVersionSchema.safeParse(base).success).toBe(true);
  });

  it('rejects an invalid interestCalculationMethod', () => {
    const result = createLoanProductVersionSchema.safeParse({ ...base, interestCalculationMethod: 'BOGUS' });
    expect(result.success).toBe(false);
  });

  it('accepts a nested penaltyRule and feeRules array', () => {
    const result = createLoanProductVersionSchema.safeParse({
      ...base,
      penaltyRule: { calculationMethod: 'OVERDUE_BALANCE_AND_INTEREST', ratePercent: '2.5' },
      feeRules: [{ name: 'Processing Fee', calculationMethod: 'FLAT', triggerEvent: 'DISBURSEMENT' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive versionNumber', () => {
    expect(createLoanProductVersionSchema.safeParse({ ...base, versionNumber: 0 }).success).toBe(false);
  });
});
