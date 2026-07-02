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

  // Milestone 8.1 remediation (audit finding H-2): see the equivalent
  // block in loanAccountSchemas.test.ts for the full rationale — a
  // malformed decimal string previously reached Money.of()/Percentage.of()
  // unvalidated and threw an unhandled parse error (500 instead of 400).
  describe('decimal field format validation (H-2)', () => {
    it('rejects a non-numeric loanAmountMin', () => {
      expect(createLoanProductVersionSchema.safeParse({ ...base, loanAmountMin: 'abc' }).success).toBe(false);
    });

    it('rejects a non-numeric loanAmountMax / loanAmountDefault', () => {
      expect(createLoanProductVersionSchema.safeParse({ ...base, loanAmountMax: 'abc' }).success).toBe(false);
      expect(createLoanProductVersionSchema.safeParse({ ...base, loanAmountDefault: 'abc' }).success).toBe(false);
    });

    it('rejects a non-numeric defaultInterestRate / minInterestRate / maxInterestRate', () => {
      expect(createLoanProductVersionSchema.safeParse({ ...base, defaultInterestRate: 'abc' }).success).toBe(false);
      expect(createLoanProductVersionSchema.safeParse({ ...base, minInterestRate: 'abc' }).success).toBe(false);
      expect(createLoanProductVersionSchema.safeParse({ ...base, maxInterestRate: 'abc' }).success).toBe(false);
    });

    it('rejects a non-numeric nested penaltyRule.ratePercent / capPercent', () => {
      const result = createLoanProductVersionSchema.safeParse({
        ...base,
        penaltyRule: { calculationMethod: 'OVERDUE_BALANCE_AND_INTEREST', ratePercent: 'abc' },
      });
      expect(result.success).toBe(false);
    });

    it('rejects a non-numeric nested feeRules[].flatAmount / percentage', () => {
      const result = createLoanProductVersionSchema.safeParse({
        ...base,
        feeRules: [{ name: 'Processing Fee', calculationMethod: 'FLAT', triggerEvent: 'DISBURSEMENT', flatAmount: 'abc' }],
      });
      expect(result.success).toBe(false);
    });
  });
});
