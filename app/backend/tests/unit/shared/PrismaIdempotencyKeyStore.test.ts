import { beforeEach, describe, expect, it, vi } from 'vitest';

const idempotencyKeyOps = { findUnique: vi.fn(), create: vi.fn() };
const prismaMock = { idempotencyKey: idempotencyKeyOps };

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaIdempotencyKeyStore } = await import('@shared/infrastructure/PrismaIdempotencyKeyStore');

describe('PrismaIdempotencyKeyStore (Milestone 9.1/9.2 CP13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('find() returns null when no row is recorded for the (key, endpoint) pair', async () => {
    idempotencyKeyOps.findUnique.mockResolvedValue(null);
    const store = new PrismaIdempotencyKeyStore();

    const result = await store.find('key-1', 'POST /loan-accounts/:id/activate');

    expect(result).toBeNull();
    expect(idempotencyKeyOps.findUnique).toHaveBeenCalledWith({
      where: { key_endpoint: { key: 'key-1', endpoint: 'POST /loan-accounts/:id/activate' } },
    });
  });

  it('find() returns the stored statusCode/responseBody when a row exists', async () => {
    idempotencyKeyOps.findUnique.mockResolvedValue({
      statusCode: 200,
      responseBody: { id: 'loan-1', status: 'ACTIVE' },
    });
    const store = new PrismaIdempotencyKeyStore();

    const result = await store.find('key-1', 'POST /loan-accounts/:id/activate');

    expect(result).toEqual({ statusCode: 200, responseBody: { id: 'loan-1', status: 'ACTIVE' } });
  });

  it('save() writes the key, endpoint, userId, statusCode, and responseBody', async () => {
    idempotencyKeyOps.create.mockResolvedValue({});
    const store = new PrismaIdempotencyKeyStore();

    await store.save('key-1', 'POST /loan-accounts/:id/payments', 'user-1', {
      statusCode: 200,
      responseBody: { remainder: '0.00' },
    });

    expect(idempotencyKeyOps.create).toHaveBeenCalledWith({
      data: {
        key: 'key-1',
        endpoint: 'POST /loan-accounts/:id/payments',
        userId: 'user-1',
        statusCode: 200,
        responseBody: { remainder: '0.00' },
      },
    });
  });
});
