import { beforeEach, describe, expect, it, vi } from 'vitest';

const coBorrowerOps = { findUnique: vi.fn(), upsert: vi.fn() };
const addressOps = { findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() };
const prismaMock = { coBorrower: coBorrowerOps, address: addressOps };

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaCoBorrowerRepository } = await import('@modules/borrower/infrastructure/PrismaCoBorrowerRepository');
const { CoBorrower } = await import('@modules/borrower/domain/CoBorrower');
const { PersonName } = await import('@modules/borrower/domain/valueObjects/PersonName');

describe('PrismaCoBorrowerRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
