import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({ __mockTxClient: true })),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaUnitOfWork, resolveClient } = await import('@shared/infrastructure/PrismaUnitOfWork');
const { prisma } = await import('@shared/database/prismaClient');

describe('PrismaUnitOfWork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the work callback inside prisma.$transaction and returns its result', async () => {
    const unitOfWork = new PrismaUnitOfWork();

    const result = await unitOfWork.run(async () => 'done');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toBe('done');
  });

  it('propagates a thrown error from work (so the transaction rolls back)', async () => {
    const unitOfWork = new PrismaUnitOfWork();

    await expect(
      unitOfWork.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('passes a TransactionContext into work that resolveClient() maps back to the tx client', async () => {
    const unitOfWork = new PrismaUnitOfWork();
    let seenClient: unknown;

    await unitOfWork.run(async (ctx) => {
      seenClient = resolveClient(ctx);
    });

    expect(seenClient).toEqual({ __mockTxClient: true });
  });
});

describe('resolveClient', () => {
  it('returns the standalone singleton when no TransactionContext is supplied', () => {
    expect(resolveClient(undefined)).toBe(prisma);
  });

  it('throws for an unrecognized TransactionContext', () => {
    expect(() => resolveClient({ __brand: 'TransactionContext' })).toThrow(
      'Unrecognized TransactionContext',
    );
  });
});
