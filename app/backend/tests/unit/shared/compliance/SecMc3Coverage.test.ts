import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { isSecMc3Covered } from '@shared/domain/compliance/SecMc3Coverage';

/**
 * BSP Circular 1133 / SEC MC 3 — all four criteria must hold concurrently for a loan to be
 * "covered" by the ceilings. Sourced from the real regulation text (`legacy/SEC/*.pdf`), confirmed
 * with the user 2026-07-20 — see `SecMc3Coverage.ts`'s own doc comment for the full citation.
 */
describe('isSecMc3Covered (BSP Circular 1133 / SEC MC 3)', () => {
  const covered = {
    principalAmount: Money.of('10000.00'),
    installmentCount: 4,
    isUnsecuredGeneralPurpose: true,
    originationDate: new Date('2022-03-03T00:00:00.000Z'),
  };

  it('is covered when all four criteria hold, at the exact boundary values', () => {
    expect(isSecMc3Covered(covered)).toBe(true);
  });

  it('is NOT covered when the product is not confirmed unsecured/general-purpose', () => {
    expect(isSecMc3Covered({ ...covered, isUnsecuredGeneralPurpose: false })).toBe(false);
  });

  it('is NOT covered when principal exceeds ₱10,000', () => {
    expect(isSecMc3Covered({ ...covered, principalAmount: Money.of('10000.01') })).toBe(false);
  });

  it('is covered at exactly ₱10,000 principal (boundary is inclusive)', () => {
    expect(isSecMc3Covered({ ...covered, principalAmount: Money.of('10000.00') })).toBe(true);
  });

  it('is NOT covered when tenor exceeds 4 months', () => {
    expect(isSecMc3Covered({ ...covered, installmentCount: 5 })).toBe(false);
  });

  it('is covered at exactly 4 months tenor (boundary is inclusive)', () => {
    expect(isSecMc3Covered({ ...covered, installmentCount: 4 })).toBe(true);
  });

  it('is NOT covered when originated before 03 March 2022', () => {
    expect(isSecMc3Covered({ ...covered, originationDate: new Date('2022-03-02T23:59:59.999Z') })).toBe(false);
  });

  it('is covered when originated exactly on 03 March 2022 (effectivity date is inclusive)', () => {
    expect(isSecMc3Covered({ ...covered, originationDate: new Date('2022-03-03T00:00:00.000Z') })).toBe(true);
  });

  it('is covered for a loan originated well after effectivity, e.g. 2024', () => {
    expect(isSecMc3Covered({ ...covered, originationDate: new Date('2024-01-01T00:00:00.000Z') })).toBe(true);
  });

  it('requires ALL FOUR criteria - failing any single one excludes the loan, even if the other three hold', () => {
    // Fails tenor only
    expect(isSecMc3Covered({ ...covered, installmentCount: 6 })).toBe(false);
    // Fails principal only
    expect(isSecMc3Covered({ ...covered, principalAmount: Money.of('50000.00') })).toBe(false);
    // Fails date only
    expect(isSecMc3Covered({ ...covered, originationDate: new Date('2020-01-01T00:00:00.000Z') })).toBe(false);
  });
});
