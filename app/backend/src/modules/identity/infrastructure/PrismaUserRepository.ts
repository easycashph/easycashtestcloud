import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type {
  CreateUserInput,
  FindManyUsersOptions,
  IUserRepository,
  UpdateUserInput,
  UserRecord,
} from '../application/ports/IUserRepository';
import { Email } from '../domain/Email';
import { RoleNotFoundError } from '../application/errors/AuthErrors';

const USER_WITH_ROLES_INCLUDE = {
  roles: { include: { role: true } },
  branch: true,
  roleClass: true,
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof USER_WITH_ROLES_INCLUDE }>;

function toUserRecord(row: UserWithRoles): UserRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    branchName: row.branch.name,
    email: row.email,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    roles: row.roles.map((userRole) => userRole.role.name),
    companyId: row.companyId,
    roleClassId: row.roleClassId,
    roleClassName: row.roleClass?.name ?? null,
    contactNumber: row.contactNumber,
    address: row.address,
    birthday: row.birthday,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Resolves role names to Role rows, throwing RoleNotFoundError (audit finding H-03) if any don't exist. */
async function resolveRoleIds(roleNames: string[]): Promise<string[]> {
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
  const resolvedNames = new Set(roles.map((role) => role.name));
  const missingNames = roleNames.filter((name) => !resolvedNames.has(name));
  if (missingNames.length > 0) {
    throw new RoleNotFoundError(missingNames);
  }
  return roles.map((role) => role.id);
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

  /** Mirrors PrismaLoanApplicationRepository.findMany: cursor pagination, newest first. LMS staff accounts have no branch dimension to filter by here — every authenticated user may view the roster. */
  async findMany(options: FindManyUsersOptions): Promise<UserRecord[]> {
    const where: Prisma.UserWhereInput = options.search
      ? {
          OR: [
            { firstName: { contains: options.search, mode: 'insensitive' } },
            { lastName: { contains: options.search, mode: 'insensitive' } },
            { email: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const rows = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: USER_WITH_ROLES_INCLUDE,
    });
    return rows.map(toUserRecord);
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const roleIds = await resolveRoleIds(input.roleNames);

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
        companyId: input.companyId,
        roleClassId: input.roleClassId,
        roles: {
          create: roleIds.map((roleId) => ({ roleId })),
        },
      },
      include: USER_WITH_ROLES_INCLUDE,
    });

    return toUserRecord(created);
  }

  async update(id: string, patch: UpdateUserInput): Promise<UserRecord> {
    const roleIds = patch.roleNames ? await resolveRoleIds(patch.roleNames) : undefined;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: patch.firstName,
        lastName: patch.lastName,
        branchId: patch.branchId,
        status: patch.status,
        companyId: patch.companyId,
        roleClassId: patch.roleClassId,
        email: patch.email,
        passwordHash: patch.passwordHash,
        contactNumber: patch.contactNumber,
        address: patch.address,
        birthday: patch.birthday,
        ...(roleIds
          ? {
              roles: {
                deleteMany: {},
                create: roleIds.map((roleId) => ({ roleId })),
              },
            }
          : {}),
      },
      include: USER_WITH_ROLES_INCLUDE,
    });

    return toUserRecord(updated);
  }

  async hasAnyUserWithRole(roleName: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { roles: { some: { role: { name: roleName } } } },
    });
    return count > 0;
  }

  async findByRolesAndBranch(roleNames: string[], branchId: string): Promise<UserRecord[]> {
    const rows = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        branchId,
        roles: { some: { role: { name: { in: roleNames } } } },
      },
      include: USER_WITH_ROLES_INCLUDE,
    });
    return rows.map(toUserRecord);
  }
}
