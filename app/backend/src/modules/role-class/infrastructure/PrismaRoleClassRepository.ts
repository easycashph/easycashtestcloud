import { prisma } from '@shared/database/prismaClient';
import { RoleClass } from '../domain/RoleClass';
import type {
  CreateRoleClassInput,
  IRoleClassRepository,
  RoleTypeRecord,
  UpdateRoleClassInput,
} from '../application/ports/IRoleClassRepository';

function toDomain(row: {
  id: string;
  roleId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  role: { name: string };
  _count: { users: number };
}): RoleClass {
  return RoleClass.fromRecord({
    id: row.id,
    roleId: row.roleId,
    roleName: row.role.name,
    name: row.name,
    userCount: row._count.users,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

const WITH_ROLE_AND_COUNT = { role: { select: { name: true } }, _count: { select: { users: true } } } as const;

export class PrismaRoleClassRepository implements IRoleClassRepository {
  async findAllRoleTypes(): Promise<RoleTypeRecord[]> {
    return prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  async findAll(): Promise<RoleClass[]> {
    const rows = await prisma.roleClass.findMany({
      include: WITH_ROLE_AND_COUNT,
      orderBy: [{ role: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<RoleClass | null> {
    const row = await prisma.roleClass.findUnique({ where: { id }, include: WITH_ROLE_AND_COUNT });
    return row ? toDomain(row) : null;
  }

  async create(input: CreateRoleClassInput): Promise<RoleClass> {
    const row = await prisma.roleClass.create({
      data: { roleId: input.roleId, name: input.name },
      include: WITH_ROLE_AND_COUNT,
    });
    return toDomain(row);
  }

  async update(id: string, input: UpdateRoleClassInput): Promise<RoleClass> {
    const row = await prisma.roleClass.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
      },
      include: WITH_ROLE_AND_COUNT,
    });
    return toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.roleClass.delete({ where: { id } });
  }
}
