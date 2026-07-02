import { describe, expect, it } from 'vitest';
import { loginSchema } from '@modules/identity/interface/http/authSchemas';

describe('loginSchema (audit finding H-02: normalizes email via the Email value object)', () => {
  it('normalizes a mixed-case, whitespace-padded email to lowercase/trimmed', () => {
    const result = loginSchema.safeParse({ email: '  Officer@EasyCash.PH  ', password: 'whatever' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('officer@easycash.ph');
    }
  });

  it('rejects an invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'whatever' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ email: 'officer@easycash.ph', password: '' });
    expect(result.success).toBe(false);
  });
});
