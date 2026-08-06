import { prisma } from '@shared/database/prismaClient';
import type { IAccessControlRepository, PermissionRecord, RoleWithPermissionsRecord } from '../application/ports/IAccessControlRepository';

export class PrismaAccessControlRepository implements IAccessControlRepository {
  async listPermissions(): Promise<PermissionRecord[]> {
    const rows = await prisma.permission.findMany({ orderBy: { code: 'asc' } });
    return rows.map((r) => ({ id: r.id, code: r.code, description: r.description }));
  }

  async listRolesWithPermissions(): Promise<RoleWithPermissionsRecord[]> {
    const rows = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      userCount: r._count.users,
      permissionCodes: r.permissions.map((rp) => rp.permission.code),
    }));
  }

  async setRolePermissions(roleId: string, permissionCodes: string[]): Promise<RoleWithPermissionsRecord> {
    const permissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      }),
    ]);

    const roles = await this.listRolesWithPermissions();
    const updated = roles.find((r) => r.id === roleId);
    if (!updated) {
      throw new Error(`Role ${roleId} not found after permission update.`);
    }
    return updated;
  }
}
