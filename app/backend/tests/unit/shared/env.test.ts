import { describe, expect, it } from 'vitest';
import { env } from '@shared/config/env';

describe('env (audit finding H-01: JWT_REFRESH_TTL_MS is derived, not dead config)', () => {
  it('pre-computes JWT_REFRESH_TTL_MS from JWT_REFRESH_TTL', () => {
    // tests/setup.ts doesn't override JWT_REFRESH_TTL, so env.ts's own
    // default ("7d") applies.
    expect(env.JWT_REFRESH_TTL).toBe('7d');
    expect(env.JWT_REFRESH_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
