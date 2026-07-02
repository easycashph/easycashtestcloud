import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshTokenOps = {
  updateMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
};

const prismaMock = {
  refreshToken: refreshTokenOps,
  // Mimics Prisma's interactive transaction API: invokes the callback with
  // a `tx` client. For these unit tests, `tx` is the same mocked
  // `refreshToken` operations — this is sufficient to verify OUR code
  // correctly delegates to $transaction and reacts to its result; it does
  // NOT (and cannot, without a real Postgres instance) verify Postgres's
  // own rollback/locking guarantees, which are the database engine's
  // responsibility, not application code's.
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));
vi.mock('@shared/config/env', () => ({ env: { JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long' } }));

const { PrismaRefreshTokenRepository } = await import(
  '@modules/identity/infrastructure/PrismaRefreshTokenRepository'
);

describe('PrismaRefreshTokenRepository.rotate (production-readiness review: transactional correctness)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a single $transaction wrapping both the revoke and the issue', async () => {
    refreshTokenOps.updateMany.mockResolvedValue({ count: 1 });
    refreshTokenOps.create.mockResolvedValue({ id: 'rt-2' });
    const repo = new PrismaRefreshTokenRepository();

    await repo.rotate('rt-1', { userId: 'user-1', expiresAt: new Date(Date.now() + 60_000) });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(refreshTokenOps.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(refreshTokenOps.create).toHaveBeenCalled();
  });

  it('returns the new token when the conditional revoke affects exactly one row', async () => {
    refreshTokenOps.updateMany.mockResolvedValue({ count: 1 });
    refreshTokenOps.create.mockResolvedValue({ id: 'rt-2' });
    const repo = new PrismaRefreshTokenRepository();

    const result = await repo.rotate('rt-1', { userId: 'user-1', expiresAt: new Date(Date.now() + 60_000) });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('rt-2');
    expect(typeof result?.rawToken).toBe('string');
  });

  it('returns null and never calls create when the conditional revoke affects zero rows (lost the race / already revoked)', async () => {
    refreshTokenOps.updateMany.mockResolvedValue({ count: 0 });
    const repo = new PrismaRefreshTokenRepository();

    const result = await repo.rotate('rt-1', { userId: 'user-1', expiresAt: new Date(Date.now() + 60_000) });

    expect(result).toBeNull();
    expect(refreshTokenOps.create).not.toHaveBeenCalled();
  });

  it('propagates a failure from create() — the transaction wrapper is what makes this roll back the revoke in real Postgres', async () => {
    refreshTokenOps.updateMany.mockResolvedValue({ count: 1 });
    refreshTokenOps.create.mockRejectedValue(new Error('connection lost'));
    const repo = new PrismaRefreshTokenRepository();

    await expect(
      repo.rotate('rt-1', { userId: 'user-1', expiresAt: new Date(Date.now() + 60_000) }),
    ).rejects.toThrow('connection lost');
  });
});
