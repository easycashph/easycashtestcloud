import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaAuditLogger } = await import('@modules/identity/infrastructure/PrismaAuditLogger');

describe('PrismaAuditLogger (audit finding H-04: must never throw)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes an entry successfully under normal conditions', async () => {
    prismaMock.auditLog.create.mockResolvedValue({});
    const logger = new PrismaAuditLogger();

    await expect(
      logger.log({ action: 'LOGIN_SUCCESS', entityType: 'User', entityId: 'user-1' }),
    ).resolves.toBeUndefined();
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it('does NOT throw when the underlying database write fails', async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error('connection timeout'));
    const logger = new PrismaAuditLogger();

    // The whole point of H-04: this must resolve, not reject, so a
    // failing audit write can never mask a login/refresh result or fail
    // an otherwise-successful authentication request.
    await expect(
      logger.log({ action: 'LOGIN_FAILED', entityType: 'User', entityId: 'unknown' }),
    ).resolves.toBeUndefined();
  });
});
