import { prisma } from '@shared/database/prismaClient';
import type { IPermissionCodesRepository } from '../application/ports/IPermissionCodesRepository';

export class PrismaPermissionCodesRepository implements IPermissionCodesRepository {
  async getGrantedPermissionCodes(roleNames: string[]): Promise<string[]> {
    const grants = await prisma.rolePermission.findMany({
      where: { role: { name: { in: roleNames } } },
      select: { permission: { select: { code: true } } },
    });
    return [...new Set(grants.map((g) => g.permission.code))];
  }
}
