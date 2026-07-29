import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  role: {
    findMany: vi.fn(),
  },
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

// Imported AFTER the mock is registered, per vitest's hoisting model.
const { PrismaUserRepository } = await import('@modules/identity/infrastructure/PrismaUserRepository');
const { RoleNotFoundError } = await import('@modules/identity/application/errors/AuthErrors');

const baseUserRow = {
  id: 'user-1',
  branchId: 'branch-1',
  branch: { name: 'Manila' },
  email: 'officer@easycash.ph',
  passwordHash: 'hash',
  firstName: 'Ana',
  lastName: 'Reyes',
  status: 'ACTIVE' as const,
  roles: [{ role: { name: 'CRM' } }],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('PrismaUserRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('audit finding H-02: email normalization', () => {
    it('findByEmail normalizes casing/whitespace before querying', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUserRow);
      const repo = new PrismaUserRepository();

      await repo.findByEmail('  Officer@EasyCash.PH  ');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'officer@easycash.ph' } }),
      );
    });

    it('create() normalizes the email before writing', async () => {
      prismaMock.role.findMany.mockResolvedValue([{ id: 'role-1', name: 'CRM' }]);
      prismaMock.user.create.mockResolvedValue(baseUserRow);
      const repo = new PrismaUserRepository();

      await repo.create({
        branchId: 'branch-1',
        email: '  Officer@EasyCash.PH  ',
        passwordHash: 'hash',
        firstName: 'Ana',
        lastName: 'Reyes',
        roleNames: ['CRM'],
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'officer@easycash.ph' }),
        }),
      );
    });
  });

  describe('audit finding H-03: role resolution must not fail silently', () => {
    it('throws RoleNotFoundError when a requested role name does not resolve', async () => {
      // Only "CRM" resolves; "MIS" does not (e.g. seed never ran).
      prismaMock.role.findMany.mockResolvedValue([{ id: 'role-1', name: 'CRM' }]);
      const repo = new PrismaUserRepository();

      await expect(
        repo.create({
          branchId: 'branch-1',
          email: 'admin@easycash.ph',
          passwordHash: 'hash',
          firstName: 'Admin',
          lastName: 'Account',
          roleNames: ['MIS'],
        }),
      ).rejects.toThrow(RoleNotFoundError);

      // Must never fall through to creating a role-less user.
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('succeeds when every requested role resolves', async () => {
      prismaMock.role.findMany.mockResolvedValue([{ id: 'role-1', name: 'MIS' }]);
      prismaMock.user.create.mockResolvedValue({
        ...baseUserRow,
        roles: [{ role: { name: 'MIS' } }],
      });
      const repo = new PrismaUserRepository();

      const result = await repo.create({
        branchId: 'branch-1',
        email: 'admin@easycash.ph',
        passwordHash: 'hash',
        firstName: 'Admin',
        lastName: 'Account',
        roleNames: ['MIS'],
      });

      expect(result.roles).toEqual(['MIS']);
      expect(prismaMock.user.create).toHaveBeenCalled();
    });
  });
});
