import { prisma } from '@shared/database/prismaClient';
import { RoleClass } from '../domain/RoleClass';
import type {
  CreateRoleClassInput,
  IRoleClassRepository,
  RoleTypeRecord,
  UpdateRoleClassInput,
} from '../application/ports/IRoleClassRepository';

function toDomain(row: { id: string; roleId: string; name: string; createdAt: Date; updatedAt: Date; role: { name: string } }): RoleClass {
  return RoleClass.fromRecord({
    id: row.id,
    roleId: row.roleId,
    roleName: row.role.name,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class PrismaRoleClassRepository implements IRoleClassRepository {
  async findAllRoleTypes(): Promise<RoleTypeRecord[]> {
    return prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  async findAll(): Promise<RoleClass[]> {
    const rows = await prisma.roleClass.findMany({
      include: { role: { select: { name: true } } },
      orderBy: [{ role: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<RoleClass | null> {
    const row = await prisma.roleClass.findUnique({ where: { id }, include: { role: { select: { name: true } } } });
    return row ? toDomain(row) : null;
  }

  async create(input: CreateRoleClassInput): Promise<RoleClass> {
    const row = await prisma.roleClass.create({
      data: { roleId: input.roleId, name: input.name },
      include: { role: { select: { name: true } } },
    });
    return toDomain(row);
  }

  async update(id: string, input: UpdateRoleClassInput): Promise<RoleClass> {
    const row = await prisma.roleClass.update({
      where: { id },
      data: { name: input.name },
      include: { role: { select: { name: true } } },
    });
    return toDomain(row);
  }
}
