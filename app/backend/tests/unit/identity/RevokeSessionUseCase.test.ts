import { describe, expect, it, vi } from 'vitest';
import { RevokeSessionUseCase } from '@modules/identity/application/use-cases/RevokeSessionUseCase';
import { SessionNotFoundError } from '@modules/identity/application/errors/AuthErrors';
import type { IRefreshTokenRepository, RefreshTokenRecord } from '@modules/identity/application/ports/IRefreshTokenRepository';

function buildDeps(record: RefreshTokenRecord | null) {
  const refreshTokenRepository: IRefreshTokenRepository = {
    issue: vi.fn(),
    findByRawToken: vi.fn(),
    findById: vi.fn().mockResolvedValue(record),
    revoke: vi.fn().mockResolvedValue(true),
    revokeAllForUser: vi.fn(),
    rotate: vi.fn(),
    listActiveByUser: vi.fn(),
  };
  return { refreshTokenRepository };
}

describe('RevokeSessionUseCase', () => {
  it('revokes the session when it belongs to the requesting user', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: 'user-1', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    await new RevokeSessionUseCase(deps).execute({ userId: 'user-1', sessionId: 'rt-1' });
    expect(deps.refreshTokenRepository.revoke).toHaveBeenCalledWith('rt-1');
  });

  it('throws SessionNotFoundError, without calling revoke, when the session belongs to a different user', async () => {
    const deps = buildDeps({ id: 'rt-1', userId: 'someone-else', expiresAt: new Date(Date.now() + 60_000), revokedAt: null });
    await expect(new RevokeSessionUseCase(deps).execute({ userId: 'user-1', sessionId: 'rt-1' })).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
    expect(deps.refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });

  it('throws SessionNotFoundError when the session id does not exist', async () => {
    const deps = buildDeps(null);
    await expect(new RevokeSessionUseCase(deps).execute({ userId: 'user-1', sessionId: 'unknown' })).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
    expect(deps.refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });
});
