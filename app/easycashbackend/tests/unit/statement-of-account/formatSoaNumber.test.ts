import { describe, expect, it } from 'vitest';
import { formatSoaNumber } from '@modules/statement-of-account/domain/formatSoaNumber';

describe('formatSoaNumber (ADR-052, matches the legacy Excel/VBA tool\'s numbering)', () => {
  it('formats as SOA-{5-digit sequence}-{MMDDYYYY}', () => {
    expect(formatSoaNumber(1, new Date('2026-07-19T00:00:00.000Z'))).toBe('SOA-00001-07192026');
  });

  it('zero-pads the sequence number to 5 digits', () => {
    expect(formatSoaNumber(42, new Date('2026-01-05T00:00:00.000Z'))).toBe('SOA-00042-01052026');
  });

  it('does not truncate a sequence number already 5+ digits', () => {
    expect(formatSoaNumber(123456, new Date('2026-12-31T00:00:00.000Z'))).toBe('SOA-123456-12312026');
  });
});
