import { beforeEach, describe, expect, it, vi } from 'vitest';

const coBorrowerOps = { findUnique: vi.fn(), upsert: vi.fn() };
const addressOps = { findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() };
const prismaMock = {
  coBorrower: coBorrowerOps,
  address: addressOps,
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaCoBorrowerRepository } = await import('@modules/borrower/infrastructure/PrismaCoBorrowerRepository');
const { CoBorrower } = await import('@modules/borrower/domain/CoBorrower');
const { PersonName } = await import('@modules/borrower/domain/valueObjects/PersonName');

describe('PrismaCoBorrowerRepository', () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so a mockRejectedValue set by one
    // test can never leak its implementation into a later test.
    vi.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  });

  it('findById queries addresses by ownerType CO_BORROWER', async () => {
    coBorrowerOps.findUnique.mockResolvedValue({
      id: 'cb-1',
      firstName: 'Maria',
      lastName: 'Santos',
      gender: null,
      civilStatus: null,
      birthDate: null,
      phoneNumber: null,
      emailAddress: null,
      relationship: null,
      legacyId: null,
    });
    addressOps.findMany.mockResolvedValue([]);

    const repo = new PrismaCoBorrowerRepository();
    await repo.findById('cb-1');

    expect(addressOps.findMany).toHaveBeenCalledWith({ where: { ownerType: 'CO_BORROWER', ownerId: 'cb-1' } });
  });

  it('save upserts the co-borrower row', async () => {
    addressOps.count.mockResolvedValue(0);
    const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos') });

    const repo = new PrismaCoBorrowerRepository();
    await repo.save(coBorrower);

    expect(coBorrowerOps.upsert).toHaveBeenCalledTimes(1);
  });

  // Audit finding H-2 (Milestone 7.1 remediation).
  describe('save atomicity', () => {
    it('wraps the multi-statement write in a single prisma.$transaction when no outer ctx is supplied', async () => {
      addressOps.count.mockResolvedValue(0);
      const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos') });

      const repo = new PrismaCoBorrowerRepository();
      await repo.save(coBorrower);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rolls back — propagates the error — if the address write fails after the co-borrower upsert succeeds', async () => {
      const { Address } = await import('@modules/borrower/domain/valueObjects/Address');
      addressOps.count.mockResolvedValue(0);
      addressOps.createMany.mockRejectedValue(new Error('address write failed'));
      const coBorrower = CoBorrower.create({
        name: PersonName.of('Maria', 'Santos'),
        addresses: [Address.of({ street: 'Rizal St.' })],
      });

      const repo = new PrismaCoBorrowerRepository();
      await expect(repo.save(coBorrower)).rejects.toThrow('address write failed');
    });

    it('joins an outer TransactionContext instead of opening a nested transaction', async () => {
      const { PrismaUnitOfWork } = await import('@shared/infrastructure/PrismaUnitOfWork');
      const unitOfWork = new PrismaUnitOfWork();
      const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos') });
      const repo = new PrismaCoBorrowerRepository();

      await unitOfWork.run(async (ctx) => {
        vi.clearAllMocks(); // isolate from run()'s own $transaction call
        addressOps.count.mockResolvedValue(0);
        await repo.save(coBorrower, ctx);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(coBorrowerOps.upsert).toHaveBeenCalledTimes(1);
      });
    });
  });
});
