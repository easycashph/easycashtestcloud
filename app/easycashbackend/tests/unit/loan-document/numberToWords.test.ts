import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { moneyToWords } from '@modules/loan-document/application/numberToWords';

describe('moneyToWords (ADR-051 §8 {LoanAmountWords})', () => {
  it('spells out a whole-peso amount with no centavos', () => {
    expect(moneyToWords(new Decimal('10000.00'))).toBe('Ten Thousand Pesos');
  });

  it('spells out pesos and centavos together', () => {
    expect(moneyToWords(new Decimal('1234.56'))).toBe('One Thousand Two Hundred Thirty-Four Pesos and Fifty-Six Centavos');
  });

  it('uses singular "Peso"/"Centavo" for exactly 1', () => {
    expect(moneyToWords(new Decimal('1.01'))).toBe('One Peso and One Centavo');
  });

  it('handles zero', () => {
    expect(moneyToWords(new Decimal('0.00'))).toBe('Zero Pesos');
  });

  it('handles a large multi-million amount', () => {
    expect(moneyToWords(new Decimal('2500000.00'))).toBe('Two Million Five Hundred Thousand Pesos');
  });
});
