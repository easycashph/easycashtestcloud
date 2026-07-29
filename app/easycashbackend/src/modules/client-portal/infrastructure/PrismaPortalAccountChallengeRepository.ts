import { createHmac, randomInt } from 'node:crypto';
import { prisma } from '@shared/database/prismaClient';
import { env } from '@shared/config/env';
import type {
  CreatePortalAccountChallengeInput,
  CreatedPortalAccountChallenge,
  IPortalAccountChallengeRepository,
  PortalAccountChallengeRecord,
  PortalChallengeChannel,
  PortalChallengePurpose,
} from '../application/ports/IPortalAccountChallengeRepository';

/** Same keyed-HMAC approach as identity's PrismaTwoFactorChallengeRepository - deliberately keyed
 * with PORTAL_JWT_SECRET (this module's own secret), never JWT_REFRESH_SECRET, keeping the two
 * auth realms' cryptographic material fully separate. */
function hashCode(code: string): string {
  return createHmac('sha256', env.PORTAL_JWT_SECRET).update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function toRecord(row: {
  id: string;
  portalAccountId: string;
  purpose: string;
  channel: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}): PortalAccountChallengeRecord {
  return {
    id: row.id,
    portalAccountId: row.portalAccountId,
    purpose: row.purpose as PortalChallengePurpose,
    channel: row.channel as PortalChallengeChannel,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    consumedAt: row.consumedAt,
  };
}

export class PrismaPortalAccountChallengeRepository implements IPortalAccountChallengeRepository {
  async create(input: CreatePortalAccountChallengeInput): Promise<CreatedPortalAccountChallenge> {
    const code = generateCode();
    const codeHash = hashCode(code);

    const created = await prisma.portalAccountChallenge.create({
      data: {
        portalAccountId: input.portalAccountId,
        purpose: input.purpose,
        channel: input.channel,
        codeHash,
        expiresAt: input.expiresAt,
      },
    });

    return { id: created.id, code };
  }

  async findById(id: string): Promise<PortalAccountChallengeRecord | null> {
    const row = await prisma.portalAccountChallenge.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async verifyAndConsume(id: string, code: string): Promise<boolean> {
    const codeHash = hashCode(code);
    const result = await prisma.portalAccountChallenge.updateMany({
      where: { id, codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }

  async incrementAttempts(id: string): Promise<number> {
    const updated = await prisma.portalAccountChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts;
  }
}
