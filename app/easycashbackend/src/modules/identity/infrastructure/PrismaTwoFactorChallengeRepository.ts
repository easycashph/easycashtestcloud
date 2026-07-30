import { createHmac, randomInt } from 'node:crypto';
import { prisma } from '@shared/database/prismaClient';
import { env } from '@shared/config/env';
import type {
  CreateTwoFactorChallengeInput,
  CreatedTwoFactorChallenge,
  ITwoFactorChallengeRepository,
  TwoFactorChallengeRecord,
  TwoFactorChannel,
  TwoFactorPurpose,
} from '../application/ports/ITwoFactorChallengeRepository';

/** Same keyed-HMAC approach as PrismaRefreshTokenRepository's hashToken - see
 * TwoFactorChallenge.codeHash's doc comment in schema.prisma for why bcrypt isn't used here. */
function hashCode(code: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(code).digest('hex');
}

function generateCode(): string {
  // 6 digits, zero-padded - randomInt's upper bound is exclusive, so 0..999999 inclusive.
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function toRecord(row: {
  id: string;
  userId: string;
  purpose: string;
  channel: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}): TwoFactorChallengeRecord {
  return {
    id: row.id,
    userId: row.userId,
    purpose: row.purpose as TwoFactorPurpose,
    channel: row.channel as TwoFactorChannel,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    consumedAt: row.consumedAt,
  };
}

export class PrismaTwoFactorChallengeRepository implements ITwoFactorChallengeRepository {
  async create(input: CreateTwoFactorChallengeInput): Promise<CreatedTwoFactorChallenge> {
    const code = generateCode();
    const codeHash = hashCode(code);

    const created = await prisma.twoFactorChallenge.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        channel: input.channel,
        codeHash,
        expiresAt: input.expiresAt,
      },
    });

    return { id: created.id, code };
  }

  async findById(id: string): Promise<TwoFactorChallengeRecord | null> {
    const row = await prisma.twoFactorChallenge.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async verifyAndConsume(id: string, code: string): Promise<boolean> {
    const codeHash = hashCode(code);
    const result = await prisma.twoFactorChallenge.updateMany({
      where: { id, codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }

  async incrementAttempts(id: string): Promise<number> {
    const updated = await prisma.twoFactorChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts;
  }
}
