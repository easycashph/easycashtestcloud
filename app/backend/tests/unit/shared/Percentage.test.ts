import { describe, expect, it } from 'vitest';
import { Percentage } from '@shared/domain/Percentage';
import { InvalidPercentageError } from '@shared/domain/errors/FinancialDomainErrors';

describe('Percentage', () => {
  describe('of', () => {
    it('accepts a value within Decimal(6,3) precision', () => {
      expect(Percentage.of('12.5').toString()).toBe('12.500');
      expect(Percentage.of('999.999').toString()).toBe('999.999');
    });

    it('throws InvalidPercentageError for more than 3 decimal places', () => {
      expect(() => Percentage.of('12.5001')).toThrow(InvalidPercentageError);
    });

    it('throws InvalidPercentageError at/above the magnitude boundary', () => {
      expect(() => Percentage.of('1000')).toThrow(InvalidPercentageError);
    });

    it('throws InvalidPercentageError for non-finite values', () => {
      expect(() => Percentage.of(NaN)).toThrow(InvalidPercentageError);
    });
  });

  describe('asFraction', () => {
    it('converts a percentage to its fractional form', () => {
      expect(Percentage.of('12.5').asFraction().toString()).toBe('0.125');
      expect(Percentage.ZERO.asFraction().toString()).toBe('0');
    });
  });

  describe('comparisons', () => {
    it('isZero / isNegative / equals', () => {
      expect(Percentage.ZERO.isZero()).toBe(true);
      expect(Percentage.of('-1').isNegative()).toBe(true);
      expect(Percentage.of('12.5').equals(Percentage.of('12.500'))).toBe(true);
    });
  });
});
