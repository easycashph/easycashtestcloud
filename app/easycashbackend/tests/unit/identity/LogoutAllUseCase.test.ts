import { describe, expect, it, vi } from 'vitest';
import { LogoutAllUseCase } from '@modules/identity/application/use-cases/LogoutAllUseCase';
import type { IRefreshTokenRepository } from '@modules/identity/application/ports/IRefreshTokenRepository';

describe('LogoutAllUseCase (production-readiness review: gap fill — previously zero coverage)', () => {
  it('revokes every active refresh token for the given user and reports the count', async () => {
    const refreshTokenRepository: IRefreshTokenRepository = {
      issue: vi.fn(),
      findByRawToken: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn().mockResolvedValue(3),
      rotate: vi.fn(),
    };

    const result = await new LogoutAllUseCase({ refreshTokenRepository }).execute({ userId: 'user-1' });

    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ revokedCount: 3 });
  });

  it('reports zero when the user had no active sessions', async () => {
    const refreshTokenRepository: IRefreshTokenRepository = {
      issue: vi.fn(),
      findByRawToken: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn().mockResolvedValue(0),
      rotate: vi.fn(),
    };

    const result = await new LogoutAllUseCase({ refreshTokenRepository }).execute({ userId: 'user-1' });
    expect(result).toEqual({ revokedCount: 0 });
  });
});
