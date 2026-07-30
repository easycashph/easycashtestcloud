import { describe, expect, it, vi } from 'vitest';
import { LogoutUseCase } from '@modules/identity/application/use-cases/LogoutUseCase';
import type { IRefreshTokenRepository, RefreshTokenRecord } from '@modules/identity/application/ports/IRefreshTokenRepository';

function buildDeps(record: RefreshTokenRecord | null) {
  const refreshTokenRepository: IRefreshTokenRepository = {
    issue: vi.fn(),
    findByRawToken: vi.fn().mockResolvedValue(record),
    revoke: vi.fn().mockResolvedValue(true),
    revokeAllForUser: vi.fn(),
    rotate: vi.fn(),
  };
  return { refreshTokenRepository };
}

describe('LogoutUseCase (production-readiness review: gap fill — previously zero coverage)', () => {
  it('revokes the matching token when one is found and not already revoked', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    await new LogoutUseCase(deps).execute({ rawRefreshToken: 'raw' });
    expect(deps.refreshTokenRepository.revoke).toHaveBeenCalledWith('rt-1');
  });

  it('is a no-op (does not throw, does not call revoke) when no token is presented', async () => {
    const deps = buildDeps(null);
    await expect(new LogoutUseCase(deps).execute({})).resolves.toBeUndefined();
    expect(deps.refreshTokenRepository.findByRawToken).not.toHaveBeenCalled();
    expect(deps.refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });

  it('is a no-op when the presented token does not match any record (idempotent logout)', async () => {
    const deps = buildDeps(null);
    await expect(new LogoutUseCase(deps).execute({ rawRefreshToken: 'unknown' })).resolves.toBeUndefined();
    expect(deps.refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });

  it('is a no-op when the token is already revoked (idempotent — does not call revoke again)', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() });
    await expect(new LogoutUseCase(deps).execute({ rawRefreshToken: 'raw' })).resolves.toBeUndefined();
    expect(deps.refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });
});
