import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { DecliningBalanceInterestCalculator } from '@shared/domain/calculation/DecliningBalanceInterestCalculator';

// Real-loan test vectors, cited verbatim from
// docs/Architecture/CALCULATION_ENGINE_SPEC.md §1's Examples table — each
// row is a verified, real legacy transaction, not a synthetic value.
describe('DecliningBalanceInterestCalculator (CALC-SPEC §1)', () => {
  it.each([
    // SL-REG_U1V1J, installment 1
    ['17782.61', '4.95', '880.24'],
    // SL-REG_U1V1J, installment 2
    ['15164.97', '4.95', '750.67'],
    // SL-LAZ_V5N0R, installment 1
    ['2000.00', '24.99', '499.80'],
  ])('%s @ %s%% => %s (exact centavo match to real transaction data)', (balance, rate, expected) => {
    const result = DecliningBalanceInterestCalculator.calculate(Money.of(balance), Percentage.of(rate));
    expect(result.toString()).toBe(`${expected}`);
  });

  it('rounds half-up to the money scale, matching Money.multiply()', () => {
    // 100.00 * 0.125% = 0.125 -> rounds up to 0.13 under half-up.
    const result = DecliningBalanceInterestCalculator.calculate(Money.of('100.00'), Percentage.of('0.125'));
    expect(result.toString()).toBe('0.13');
  });

  it('returns zero interest for a zero balance', () => {
    const result = DecliningBalanceInterestCalculator.calculate(Money.of('0.00'), Percentage.of('4.95'));
    expect(result.isZero()).toBe(true);
  });
});
