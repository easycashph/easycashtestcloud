import { describe, expect, it, vi } from 'vitest';
import { ListSessionsUseCase } from '@modules/identity/application/use-cases/ListSessionsUseCase';
import type { IRefreshTokenRepository, SessionRecord } from '@modules/identity/application/ports/IRefreshTokenRepository';

function buildDeps(sessions: SessionRecord[]) {
  const refreshTokenRepository: IRefreshTokenRepository = {
    issue: vi.fn(),
    findByRawToken: vi.fn(),
    findById: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    rotate: vi.fn(),
    listActiveByUser: vi.fn().mockResolvedValue(sessions),
  };
  return { refreshTokenRepository };
}

describe('ListSessionsUseCase', () => {
  it('maps repository records to the wire shape, flagging the matching one isCurrent', async () => {
    const createdAt = new Date('2026-07-21T00:00:00Z');
    const deps = buildDeps([
      { id: 'rt-1', createdAt, createdByIp: '203.0.113.5', userAgent: 'Mozilla/5.0 Chrome' },
      { id: 'rt-2', createdAt, createdByIp: null, userAgent: null },
    ]);

    const result = await new ListSessionsUseCase(deps).execute({ userId: 'user-1', currentSessionId: 'rt-2' });

    expect(result).toEqual([
      { id: 'rt-1', createdAt: createdAt.toISOString(), ipAddress: '203.0.113.5', userAgent: 'Mozilla/5.0 Chrome', isCurrent: false },
      { id: 'rt-2', createdAt: createdAt.toISOString(), ipAddress: null, userAgent: null, isCurrent: true },
    ]);
    expect(deps.refreshTokenRepository.listActiveByUser).toHaveBeenCalledWith('user-1');
  });

  it('returns an empty list when the user has no active sessions', async () => {
    const deps = buildDeps([]);
    const result = await new ListSessionsUseCase(deps).execute({ userId: 'user-1', currentSessionId: 'rt-1' });
    expect(result).toEqual([]);
  });
});
