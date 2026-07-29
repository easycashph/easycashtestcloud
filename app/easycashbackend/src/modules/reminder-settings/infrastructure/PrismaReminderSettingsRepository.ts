import { prisma } from '@shared/database/prismaClient';
import type { IReminderSettingsRepository, ReminderSettings, UpdateReminderSettingsInput } from '../application/ports/IReminderSettingsRepository';

const SINGLETON_ID = 'singleton';

function toDomain(row: {
  smsEnabled: boolean;
  emailEnabled: boolean;
  signingSmsEnabled: boolean;
  signingEmailEnabled: boolean;
  portalEmailEnabled: boolean;
  portalSmsEnabled: boolean;
  updatedAt: Date;
  updatedByUserId: string | null;
}): ReminderSettings {
  return {
    smsEnabled: row.smsEnabled,
    emailEnabled: row.emailEnabled,
    signingSmsEnabled: row.signingSmsEnabled,
    signingEmailEnabled: row.signingEmailEnabled,
    portalEmailEnabled: row.portalEmailEnabled,
    portalSmsEnabled: row.portalSmsEnabled,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

export class PrismaReminderSettingsRepository implements IReminderSettingsRepository {
  async get(): Promise<ReminderSettings> {
    const row = await prisma.reminderSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
    return toDomain(row);
  }

  async update(input: UpdateReminderSettingsInput): Promise<ReminderSettings> {
    const row = await prisma.reminderSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        smsEnabled: input.smsEnabled ?? false,
        emailEnabled: input.emailEnabled ?? false,
        signingSmsEnabled: input.signingSmsEnabled ?? false,
        signingEmailEnabled: input.signingEmailEnabled ?? false,
        portalEmailEnabled: input.portalEmailEnabled ?? false,
        portalSmsEnabled: input.portalSmsEnabled ?? false,
        updatedByUserId: input.updatedByUserId,
      },
      update: {
        ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
        ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
        ...(input.signingSmsEnabled !== undefined ? { signingSmsEnabled: input.signingSmsEnabled } : {}),
        ...(input.signingEmailEnabled !== undefined ? { signingEmailEnabled: input.signingEmailEnabled } : {}),
        ...(input.portalEmailEnabled !== undefined ? { portalEmailEnabled: input.portalEmailEnabled } : {}),
        ...(input.portalSmsEnabled !== undefined ? { portalSmsEnabled: input.portalSmsEnabled } : {}),
        updatedByUserId: input.updatedByUserId,
      },
    });
    return toDomain(row);
  }
}
