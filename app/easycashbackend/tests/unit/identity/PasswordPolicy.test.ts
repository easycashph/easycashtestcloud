import { describe, expect, it } from 'vitest';
import { PasswordPolicy } from '@modules/identity/domain/PasswordPolicy';

describe('PasswordPolicy', () => {
  it('rejects passwords shorter than the minimum length', () => {
    expect(PasswordPolicy.isValid('short')).toBe(false);
    expect(PasswordPolicy.validate('short')).toContain('TOO_SHORT');
  });

  it('accepts passwords meeting the minimum length', () => {
    const ok = 'a'.repeat(PasswordPolicy.MIN_LENGTH);
    expect(PasswordPolicy.isValid(ok)).toBe(true);
    expect(PasswordPolicy.validate(ok)).toHaveLength(0);
  });
});
