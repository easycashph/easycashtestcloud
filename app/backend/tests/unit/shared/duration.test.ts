import { describe, expect, it } from 'vitest';
import { parseDurationMs } from '@shared/config/duration';

describe('parseDurationMs (audit finding H-01)', () => {
  it('parses each supported unit', () => {
    expect(parseDurationMs('500ms')).toBe(500);
    expect(parseDurationMs('15s')).toBe(15_000);
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
    expect(parseDurationMs('12h')).toBe(12 * 3_600_000);
    expect(parseDurationMs('7d')).toBe(7 * 86_400_000);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDurationMs('  7d  ')).toBe(7 * 86_400_000);
  });

  it('returns null for an unrecognized format instead of throwing', () => {
    expect(parseDurationMs('7 days')).toBeNull();
    expect(parseDurationMs('abc')).toBeNull();
    expect(parseDurationMs('')).toBeNull();
    expect(parseDurationMs('7')).toBeNull();
  });
});
