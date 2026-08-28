import { prisma } from '@shared/database/prismaClient';
import type { ISecuritySettingsRepository, SecuritySettings, UpdateSecuritySettingsInput } from '../application/ports/ISecuritySettingsRepository';

const SINGLETON_ID = 'singleton';

function toDomain(row: { enforceTwoFactorForAllUsers: boolean; updatedAt: Date; updatedByUserId: string | null }): SecuritySettings {
  return {
    enforceTwoFactorForAllUsers: row.enforceTwoFactorForAllUsers,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

export class PrismaSecuritySettingsRepository implements ISecuritySettingsRepository {
  async get(): Promise<SecuritySettings> {
    const row = await prisma.securitySettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
    return toDomain(row);
  }

  async update(input: UpdateSecuritySettingsInput): Promise<SecuritySettings> {
    const row = await prisma.securitySettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        enforceTwoFactorForAllUsers: input.enforceTwoFactorForAllUsers ?? false,
        updatedByUserId: input.updatedByUserId,
      },
      update: {
        ...(input.enforceTwoFactorForAllUsers !== undefined ? { enforceTwoFactorForAllUsers: input.enforceTwoFactorForAllUsers } : {}),
        updatedByUserId: input.updatedByUserId,
      },
    });
    return toDomain(row);
  }
}
