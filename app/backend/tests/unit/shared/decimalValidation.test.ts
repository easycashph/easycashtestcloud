import { describe, expect, it } from 'vitest';
import { decimalStringSchema } from '@shared/http/decimalValidation';

describe('decimalStringSchema (Milestone 8.1 remediation, H-2)', () => {
  it('accepts a well-formed positive decimal', () => {
    expect(decimalStringSchema.safeParse('1000.00').success).toBe(true);
  });

  it('accepts a well-formed integer (no decimal point required)', () => {
    expect(decimalStringSchema.safeParse('1000').success).toBe(true);
  });

  it('accepts a well-formed negative decimal', () => {
    expect(decimalStringSchema.safeParse('-500.25').success).toBe(true);
  });

  it('accepts a small decimal like a rate', () => {
    expect(decimalStringSchema.safeParse('2.5').success).toBe(true);
  });

  it('rejects a non-numeric string', () => {
    expect(decimalStringSchema.safeParse('abc').success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(decimalStringSchema.safeParse('').success).toBe(false);
  });

  it('rejects a string with trailing garbage', () => {
    expect(decimalStringSchema.safeParse('1000.00abc').success).toBe(false);
  });

  it('rejects a string with embedded whitespace', () => {
    expect(decimalStringSchema.safeParse('1000 .00').success).toBe(false);
  });

  it('rejects scientific notation', () => {
    expect(decimalStringSchema.safeParse('1e10').success).toBe(false);
  });

  it('rejects multiple decimal points', () => {
    expect(decimalStringSchema.safeParse('1.000.00').success).toBe(false);
  });

  it('rejects a lone minus sign or a lone decimal point', () => {
    expect(decimalStringSchema.safeParse('-').success).toBe(false);
    expect(decimalStringSchema.safeParse('.').success).toBe(false);
  });

  it('rejects a comma-formatted number (not accepted as-is)', () => {
    expect(decimalStringSchema.safeParse('1,000.00').success).toBe(false);
  });

  it('rejects null/undefined/non-string types', () => {
    expect(decimalStringSchema.safeParse(null).success).toBe(false);
    expect(decimalStringSchema.safeParse(undefined).success).toBe(false);
    expect(decimalStringSchema.safeParse(1000).success).toBe(false);
  });
});
