import { createHmac, randomBytes } from 'node:crypto';
import { prisma } from '@shared/database/prismaClient';
import { env } from '@shared/config/env';
import type {
  IssuePortalTrustedDeviceInput,
  IssuedPortalTrustedDevice,
  IPortalTrustedDeviceRepository,
  PortalTrustedDeviceRecord,
  PortalTrustedDeviceSummary,
} from '../application/ports/IPortalTrustedDeviceRepository';

/** Same keyed-HMAC approach as PrismaPortalAccountChallengeRepository - keyed with
 * PORTAL_JWT_SECRET (this auth realm's own secret), never JWT_REFRESH_SECRET. */
function hashToken(rawToken: string): string {
  return createHmac('sha256', env.PORTAL_JWT_SECRET).update(rawToken).digest('hex');
}

export class PrismaPortalTrustedDeviceRepository implements IPortalTrustedDeviceRepository {
  async issue(input: IssuePortalTrustedDeviceInput): Promise<IssuedPortalTrustedDevice> {
    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawToken);
    const created = await prisma.portalTrustedDevice.create({
      data: { portalAccountId: input.portalAccountId, tokenHash, expiresAt: input.expiresAt },
    });
    return { id: created.id, rawToken };
  }

  async findValidByRawToken(rawToken: string): Promise<PortalTrustedDeviceRecord | null> {
    const tokenHash = hashToken(rawToken);
    const row = await prisma.portalTrustedDevice.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });
    return row ? { id: row.id, portalAccountId: row.portalAccountId, expiresAt: row.expiresAt } : null;
  }

  async listValidByAccount(portalAccountId: string): Promise<PortalTrustedDeviceSummary[]> {
    const rows = await prisma.portalTrustedDevice.findMany({
      where: { portalAccountId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({ id: row.id, createdAt: row.createdAt, expiresAt: row.expiresAt }));
  }

  async revoke(id: string, portalAccountId: string): Promise<void> {
    await prisma.portalTrustedDevice.deleteMany({ where: { id, portalAccountId } });
  }
}
