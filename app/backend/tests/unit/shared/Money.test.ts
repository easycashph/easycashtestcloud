import { describe, expect, it } from 'vitest';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { InvalidMoneyError } from '@shared/domain/errors/FinancialDomainErrors';

describe('Money', () => {
  describe('of', () => {
    it('normalizes to exactly 2 decimal places', () => {
      expect(Money.of('10').toString()).toBe('10.00');
      expect(Money.of(10.5).toString()).toBe('10.50');
    });

    it('throws InvalidMoneyError for more than 2 decimal places', () => {
      expect(() => Money.of('10.001')).toThrow(InvalidMoneyError);
    });

    it('throws InvalidMoneyError for non-finite values', () => {
      expect(() => Money.of(NaN)).toThrow(InvalidMoneyError);
      expect(() => Money.of(Infinity)).toThrow(InvalidMoneyError);
    });

    it('throws InvalidMoneyError for magnitude exceeding Decimal(14,2)', () => {
      expect(() => Money.of('1000000000000')).toThrow(InvalidMoneyError);
    });

    it('accepts a value at the precision boundary', () => {
      expect(Money.of('999999999999.99').toString()).toBe('999999999999.99');
    });
  });

  describe('arithmetic (pure, deterministic — no Result<T,E>)', () => {
    it('add is exact and repeatable', () => {
      const a = Money.of('10.10');
      const b = Money.of('5.05');
      expect(a.add(b).toString()).toBe('15.15');
      // Deterministic: same inputs, same output every time.
      expect(a.add(b).toString()).toBe('15.15');
    });

    it('subtract can produce a negative amount (not an error — overpayments/reversals are valid states)', () => {
      const result = Money.of('5.00').subtract(Money.of('10.00'));
      expect(result.toString()).toBe('-5.00');
      expect(result.isNegative()).toBe(true);
    });

    it('multiply applies a rate and rounds half-up to 2 decimal places', () => {
      const principal = Money.of('1000.00');
      const rate = Percentage.of('12.5');
      expect(principal.multiply(rate).toString()).toBe('125.00');
    });

    it('multiply rounds an exact half-cent result up (ROUND_HALF_UP), deterministically', () => {
      const amount = Money.of('100.00');
      const rate = Percentage.of('33.335'); // 100.00 * 0.33335 = 33.335 -> rounds to 33.34
      expect(amount.multiply(rate).toString()).toBe('33.34');
    });
  });

  describe('allocate (largest-remainder method — must sum exactly back to original)', () => {
    it('splits evenly when divisible', () => {
      const parts = Money.of('9.00').allocate(3);
      expect(parts.map((p) => p.toString())).toEqual(['3.00', '3.00', '3.00']);
    });

    it('distributes the remainder cent-by-cent to the first N parts, never losing a cent', () => {
      const parts = Money.of('10.00').allocate(3);
      expect(parts.map((p) => p.toString())).toEqual(['3.34', '3.33', '3.33']);
      const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
      expect(total.equals(Money.of('10.00'))).toBe(true);
    });

    it('is deterministic across repeated calls', () => {
      const first = Money.of('10.00').allocate(3).map((p) => p.toString());
      const second = Money.of('10.00').allocate(3).map((p) => p.toString());
      expect(first).toEqual(second);
    });

    it('throws InvalidMoneyError for a non-positive-integer part count', () => {
      expect(() => Money.of('10.00').allocate(0)).toThrow(InvalidMoneyError);
      expect(() => Money.of('10.00').allocate(-1)).toThrow(InvalidMoneyError);
      expect(() => Money.of('10.00').allocate(1.5)).toThrow(InvalidMoneyError);
    });
  });

  describe('comparisons', () => {
    it('equals, greaterThan, lessThan', () => {
      expect(Money.of('5.00').equals(Money.of('5.00'))).toBe(true);
      expect(Money.of('5.01').greaterThan(Money.of('5.00'))).toBe(true);
      expect(Money.of('4.99').lessThan(Money.of('5.00'))).toBe(true);
    });

    it('isZero / isPositive / isNegative', () => {
      expect(Money.ZERO.isZero()).toBe(true);
      expect(Money.of('0.01').isPositive()).toBe(true);
      expect(Money.of('-0.01').isNegative()).toBe(true);
    });
  });
});
