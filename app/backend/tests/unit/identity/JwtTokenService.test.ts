import { describe, expect, it } from 'vitest';
import { JwtTokenService } from '@modules/identity/infrastructure/JwtTokenService';
import type { AccessTokenClaims } from '@modules/identity/application/ports/ITokenService';

const claims: AccessTokenClaims = {
  sub: 'user-123',
  email: 'officer@easycash.ph',
  roles: ['Loan Officer'],
  branchId: 'branch-1',
  jti: 'jti-1',
};

describe('JwtTokenService', () => {
  const service = new JwtTokenService();

  it('signs and verifies a round trip, preserving all claims', () => {
    const { token, expiresAt } = service.signAccessToken(claims);
    expect(typeof token).toBe('string');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const verified = service.verifyAccessToken(token);
    expect(verified).toEqual(claims);
  });

  it('rejects a tampered token', () => {
    const { token } = service.signAccessToken(claims);
    const tampered = token.slice(0, -2) + (token.slice(-2) === 'aa' ? 'bb' : 'aa');
    expect(service.verifyAccessToken(tampered)).toBeNull();
  });

  it('rejects a malformed token string', () => {
    expect(service.verifyAccessToken('not-a-jwt')).toBeNull();
  });
});
