import { describe, expect, it } from 'vitest';
import { formatMobileNumber, formatPeso, toProperCase } from './utils';

describe('formatPeso', () => {
  it('formats a number as PHP currency', () => {
    expect(formatPeso(1234.5)).toBe('₱1,234.50');
  });
});

describe('formatMobileNumber', () => {
  it('groups an 11-digit PH mobile number', () => {
    expect(formatMobileNumber('09171234567')).toBe('0917 123 4567');
  });

  it('returns non-11-digit input unchanged', () => {
    expect(formatMobileNumber('123')).toBe('123');
  });

  it('returns "-" for null/undefined', () => {
    expect(formatMobileNumber(null)).toBe('-');
    expect(formatMobileNumber(undefined)).toBe('-');
  });
});

describe('toProperCase', () => {
  it('capitalizes each word', () => {
    expect(toProperCase('QUEZON CITY')).toBe('Quezon City');
  });

  it('handles apostrophes and hyphens as word boundaries', () => {
    expect(toProperCase("o'brien-smith")).toBe("O'Brien-Smith");
  });

  it('returns empty string for null/undefined', () => {
    expect(toProperCase(null)).toBe('');
    expect(toProperCase(undefined)).toBe('');
  });
});
