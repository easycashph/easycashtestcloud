import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { CreateUserInput, IUserRepository, UserRecord } from '../application/ports/IUserRepository';
import { Email } from '../domain/Email';
import { RoleNotFoundError } from '../application/errors/AuthErrors';

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
    // Audit finding H-02: normalize defensively at the lookup boundary too
    // (not just at the request-validation boundary in authSchemas.ts), so
    // this repository behaves consistently regardless of caller discipline.
    const row = await prisma.user.findUnique({
      where: { email: Email.normalize(email) },
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

    // Audit finding H-03: fail loudly if any requested role didn't
    // resolve, instead of silently creating a user with fewer (or zero)
    // roles than requested.
    const resolvedNames = new Set(roles.map((role) => role.name));
    const missingNames = input.roleNames.filter((name) => !resolvedNames.has(name));
    if (missingNames.length > 0) {
      throw new RoleNotFoundError(missingNames);
    }

    const created = await prisma.user.create({
      data: {
        branchId: input.branchId,
        // Audit finding H-02: normalize at the write boundary too, so
        // whatever ends up stored is always consistent regardless of
        // whether the caller already normalized.
        email: Email.normalize(input.email),
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
