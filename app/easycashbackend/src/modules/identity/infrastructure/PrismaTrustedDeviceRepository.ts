import { createHmac, randomBytes } from 'node:crypto';
import { prisma } from '@shared/database/prismaClient';
import { env } from '@shared/config/env';
import type {
  IssueTrustedDeviceInput,
  IssuedTrustedDevice,
  ITrustedDeviceRepository,
  TrustedDeviceRecord,
} from '../application/ports/ITrustedDeviceRepository';

/** Same keyed-HMAC approach as PrismaRefreshTokenRepository - deliberately the same secret
 * (JWT_REFRESH_SECRET), since a trusted-device token is, functionally, another kind of long-lived
 * staff-side session credential. */
function hashToken(rawToken: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(rawToken).digest('hex');
}

export class PrismaTrustedDeviceRepository implements ITrustedDeviceRepository {
  async issue(input: IssueTrustedDeviceInput): Promise<IssuedTrustedDevice> {
    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = hashToken(rawToken);
    const created = await prisma.trustedDevice.create({
      data: { userId: input.userId, tokenHash, expiresAt: input.expiresAt },
    });
    return { id: created.id, rawToken };
  }

  async findValidByRawToken(rawToken: string): Promise<TrustedDeviceRecord | null> {
    const tokenHash = hashToken(rawToken);
    const row = await prisma.trustedDevice.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });
    return row ? { id: row.id, userId: row.userId, expiresAt: row.expiresAt } : null;
  }
}
