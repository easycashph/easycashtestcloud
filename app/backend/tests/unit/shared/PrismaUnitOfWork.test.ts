import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({ __mockTxClient: true })),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaUnitOfWork, resolveClient, withTransaction } = await import('@shared/infrastructure/PrismaUnitOfWork');
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

// Milestone 7.1 remediation (audit findings C-2, H-2): withTransaction() is
// the shared self-wrapping helper every multi-statement repository write
// now uses, so its own transactional and rollback behavior is verified
// once here rather than trusted implicitly by each repository's tests.
describe('withTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens its own prisma.$transaction when no ctx is supplied', async () => {
    let seenClient: unknown;

    const result = await withTransaction(undefined, async (client) => {
      seenClient = client;
      return 'ok';
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(seenClient).toEqual({ __mockTxClient: true });
    expect(result).toBe('ok');
  });

  it('propagates a thrown error (rollback) when no ctx is supplied', async () => {
    await expect(
      withTransaction(undefined, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('joins the caller-supplied ctx instead of opening a nested transaction', async () => {
    const unitOfWork = new PrismaUnitOfWork();

    await unitOfWork.run(async (ctx) => {
      vi.clearAllMocks(); // isolate from run()'s own $transaction call
      let seenClient: unknown;

      await withTransaction(ctx, async (client) => {
        seenClient = client;
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(seenClient).toEqual({ __mockTxClient: true });
    });
  });

  it('propagates a thrown error when joining an existing ctx too (outer transaction rolls back)', async () => {
    const unitOfWork = new PrismaUnitOfWork();

    await expect(
      unitOfWork.run(async (ctx) =>
        withTransaction(ctx, async () => {
          throw new Error('boom');
        }),
      ),
    ).rejects.toThrow('boom');
  });
});
