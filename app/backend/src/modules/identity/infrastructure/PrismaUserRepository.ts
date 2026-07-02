import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { CreateUserInput, IUserRepository, UserRecord } from '../application/ports/IUserRepository';

const USER_WITH_ROLES_INCLUDE = {
  roles: { include: { role: true } },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof USER_WITH_ROLES_INCLUDE }>;

function toUserRecord(row: UserWithRoles): UserRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    email: row.email,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    roles: row.roles.map((userRole) => userRole.role.name),
  };
}

export class PrismaUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await prisma.user.findUnique({
      where: { email },
      include: USER_WITH_ROLES_INCLUDE,
    });
    return row ? toUserRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await prisma.user.findUnique({
      where: { id },
      include: USER_WITH_ROLES_INCLUDE,
    });
    return row ? toUserRecord(row) : null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const roles = await prisma.role.findMany({ where: { name: { in: input.roleNames } } });

    const created = await prisma.user.create({
      data: {
        branchId: input.branchId,
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        roles: {
          create: roles.map((role) => ({ roleId: role.id })),
        },
      },
      include: USER_WITH_ROLES_INCLUDE,
    });

    return toUserRecord(created);
  }

  async hasAnyUserWithRole(roleName: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { roles: { some: { role: { name: roleName } } } },
    });
    return count > 0;
  }
}
