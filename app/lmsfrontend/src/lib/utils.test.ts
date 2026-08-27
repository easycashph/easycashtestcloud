import { describe, expect, it } from 'vitest';
import { formatMobileNumber, formatPeso, toProperCase } from './utils';

describe('formatPeso', () => {
  it('formats a number as PHP currency', () => {
    expect(formatPeso(1234.5)).toBe('₱1,234.50');
  });
});

describe('formatMobileNumber', () => {
  it('groups an 11-digit PH mobile number (leading 0) with the +63 country code', () => {
    expect(formatMobileNumber('09171234567')).toBe('+63 917 123 4567');
  });

  it('groups a 12-digit PH mobile number (63 prefix, no +) with the +63 country code', () => {
    expect(formatMobileNumber('639171234567')).toBe('+63 917 123 4567');
  });

  it('groups a 10-digit PH mobile number (no prefix) with the +63 country code', () => {
    expect(formatMobileNumber('9171234567')).toBe('+63 917 123 4567');
  });

  it('returns unparseable input unchanged', () => {
    expect(formatMobileNumber('123')).toBe('123');
  });

  it('returns malformed legacy data unchanged rather than guessing', () => {
    expect(formatMobileNumber('0.999804316')).toBe('0.999804316');
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
