import { beforeEach, describe, expect, it, vi } from 'vitest';

const borrowerOps = { findUnique: vi.fn(), upsert: vi.fn() };
const addressOps = { findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() };
const prismaMock = { borrower: borrowerOps, address: addressOps };

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaBorrowerRepository } = await import('@modules/borrower/infrastructure/PrismaBorrowerRepository');
const { Borrower } = await import('@modules/borrower/domain/Borrower');
const { PersonName } = await import('@modules/borrower/domain/valueObjects/PersonName');
const { Address } = await import('@modules/borrower/domain/valueObjects/Address');

describe('PrismaBorrowerRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('returns null when no row exists', async () => {
      borrowerOps.findUnique.mockResolvedValue(null);
      const repo = new PrismaBorrowerRepository();

      await expect(repo.findById('missing')).resolves.toBeNull();
      expect(addressOps.findMany).not.toHaveBeenCalled();
    });

    it('queries addresses by ownerType BORROWER, separate from the Borrower relation include (ADR-042 §8)', async () => {
      borrowerOps.findUnique.mockResolvedValue({
        id: 'b-1',
        branchId: 'branch-1',
        assignedLoanOfficerId: null,
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        middleName: null,
        gender: null,
        birthDate: null,
        civilStatus: null,
        mobilePhone1: null,
        mobilePhone2: null,
        email: null,
        status: 'ACTIVE',
        loanCycle: 0,
        legacyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        incomeDetail: null,
        governmentId: null,
        identificationDocs: [],
        characterReferences: [],
      });
      addressOps.findMany.mockResolvedValue([{ street: 'Rizal St.', addressType: null, houseUnitNumber: null, barangay: null, cityMunicipality: null, province: null, zipCode: null, lengthOfStayMonths: null, ownershipStatus: null }]);

      const repo = new PrismaBorrowerRepository();
      const borrower = await repo.findById('b-1');

      expect(addressOps.findMany).toHaveBeenCalledWith({ where: { ownerType: 'BORROWER', ownerId: 'b-1' } });
      expect(borrower?.addresses).toHaveLength(1);
      expect(borrower?.addresses[0]?.street).toBe('Rizal St.');
    });
  });

  describe('save', () => {
    it('upserts the borrower row and replaces its address rows wholesale', async () => {
      addressOps.count.mockResolvedValue(0);
      const borrower = Borrower.create({
        branchId: 'branch-1',
        name: PersonName.of('Juan', 'Dela Cruz'),
        addresses: [Address.of({ street: 'Rizal St.' })],
      });

      const repo = new PrismaBorrowerRepository();
      await repo.save(borrower);

      expect(borrowerOps.upsert).toHaveBeenCalledTimes(1);
      expect(addressOps.deleteMany).toHaveBeenCalledWith({ where: { ownerType: 'BORROWER', ownerId: borrower.id } });
      expect(addressOps.createMany).toHaveBeenCalledWith({
        data: [{ ownerType: 'BORROWER', ownerId: borrower.id, street: 'Rizal St.' }],
      });
    });

    it('skips address writes entirely when there are none to save and none stored', async () => {
      addressOps.count.mockResolvedValue(0);
      const borrower = Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') });

      const repo = new PrismaBorrowerRepository();
      await repo.save(borrower);

      expect(addressOps.deleteMany).not.toHaveBeenCalled();
    });
  });
});
