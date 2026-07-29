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

    it('distributes the remainder cent-by-cent to the first N parts, never losing a cent (positive)', () => {
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

    // Audit finding C-1 (Milestone 7.1 remediation): the negative branch of
    // allocate() previously lost the remainder cent entirely, because the
    // signed remainder could never satisfy `index < remainderCents` once
    // it went negative. Every case below asserts BOTH the exact split AND
    // that the parts sum back to the original amount — the latter is the
    // actual invariant FINANCIAL_INVARIANTS.md §5 requires, and is what
    // the original bug violated silently.
    describe('negative amounts — must mirror the positive algorithm exactly', () => {
      it('distributes the remainder cent-by-cent to the first N parts (negative), never losing a cent', () => {
        const parts = Money.of('-10.00').allocate(3);
        expect(parts.map((p) => p.toString())).toEqual(['-3.34', '-3.33', '-3.33']);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(Money.of('-10.00'))).toBe(true);
      });

      it('splits evenly when divisible (negative)', () => {
        const parts = Money.of('-9.00').allocate(3);
        expect(parts.map((p) => p.toString())).toEqual(['-3.00', '-3.00', '-3.00']);
      });

      it('is the exact negation of the positive split for the same magnitude', () => {
        const positive = Money.of('10.00').allocate(3).map((p) => p.toString());
        const negative = Money.of('-10.00').allocate(3).map((p) => p.toString());
        expect(negative).toEqual(positive.map((p) => `-${p}`));
      });

      it('is deterministic across repeated calls (negative)', () => {
        const first = Money.of('-10.00').allocate(3).map((p) => p.toString());
        const second = Money.of('-10.00').allocate(3).map((p) => p.toString());
        expect(first).toEqual(second);
      });
    });

    describe('zero', () => {
      it('splits zero into N zero parts', () => {
        const parts = Money.ZERO.allocate(4);
        expect(parts.map((p) => p.toString())).toEqual(['0.00', '0.00', '0.00', '0.00']);
        expect(parts.every((p) => p.isZero())).toBe(true);
      });
    });

    describe('one recipient', () => {
      it('returns the whole amount unchanged for a positive amount', () => {
        expect(Money.of('123.45').allocate(1).map((p) => p.toString())).toEqual(['123.45']);
      });

      it('returns the whole amount unchanged for a negative amount', () => {
        expect(Money.of('-123.45').allocate(1).map((p) => p.toString())).toEqual(['-123.45']);
      });
    });

    describe('uneven remainder', () => {
      it('handles a remainder that is not evenly distributable (7 parts)', () => {
        const parts = Money.of('10.00').allocate(7);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(Money.of('10.00'))).toBe(true);
        // 1000 cents / 7 = 142 base, remainder 6 -> first 6 parts get 143 cents, last gets 142.
        expect(parts.map((p) => p.toString())).toEqual([
          '1.43', '1.43', '1.43', '1.43', '1.43', '1.43', '1.42',
        ]);
      });

      it('handles the same uneven remainder for a negative amount, mirrored', () => {
        const parts = Money.of('-10.00').allocate(7);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(Money.of('-10.00'))).toBe(true);
        expect(parts.map((p) => p.toString())).toEqual([
          '-1.43', '-1.43', '-1.43', '-1.43', '-1.43', '-1.43', '-1.42',
        ]);
      });
    });

    describe('very small values', () => {
      it('allocates a single-cent positive amount without losing precision', () => {
        const parts = Money.of('0.01').allocate(3);
        expect(parts.map((p) => p.toString())).toEqual(['0.01', '0.00', '0.00']);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(Money.of('0.01'))).toBe(true);
      });

      it('allocates a single-cent negative amount without losing precision', () => {
        const parts = Money.of('-0.01').allocate(3);
        expect(parts.map((p) => p.toString())).toEqual(['-0.01', '0.00', '0.00']);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(Money.of('-0.01'))).toBe(true);
      });
    });

    describe('mixed edge cases', () => {
      it('allocates across a large number of parts (parts > cents) without losing precision', () => {
        // 5 cents across 10 parts: 5 parts get 1 cent, 5 parts get 0.
        const parts = Money.of('0.05').allocate(10);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(Money.of('0.05'))).toBe(true);
        expect(parts.filter((p) => p.equals(Money.of('0.01')))).toHaveLength(5);
        expect(parts.filter((p) => p.isZero())).toHaveLength(5);
      });

      it('allocates a large positive amount across many parts and still sums exactly', () => {
        const parts = Money.of('999999999999.99').allocate(11);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(Money.of('999999999999.99'))).toBe(true);
      });

      it('allocates a large negative amount across many parts and still sums exactly', () => {
        const amount = Money.of('999999999999.99').negate();
        const parts = amount.allocate(11);
        const total = parts.reduce((sum, p) => sum.add(p), Money.ZERO);
        expect(total.equals(amount)).toBe(true);
      });
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
