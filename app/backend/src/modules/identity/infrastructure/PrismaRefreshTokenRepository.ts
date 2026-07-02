import { createHmac, randomBytes } from 'node:crypto';
import { prisma } from '@shared/database/prismaClient';
import { env } from '@shared/config/env';
import type {
  IRefreshTokenRepository,
  IssueRefreshTokenInput,
  IssuedRefreshToken,
  RefreshTokenRecord,
} from '../application/ports/IRefreshTokenRepository';

/**
 * Milestone 6 plan §3/§7/§Assumptions #5: refresh tokens are opaque random
 * strings, never JWTs. What's persisted is HMAC-SHA256(rawToken,
 * JWT_REFRESH_SECRET) — deterministic (so the existing `tokenHash @unique`
 * column supports an O(1) lookup, unlike bcrypt's salted output) and keyed
 * (a pepper: DB exfiltration alone isn't enough to forge a matching hash).
 * The raw token is returned to the caller exactly once, at issuance, and
 * is never itself persisted anywhere.
 */
function hashToken(rawToken: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(rawToken).digest('hex');
}

function toRecord(row: { id: string; userId: string; expiresAt: Date; revokedAt: Date | null }): RefreshTokenRecord {
  return { id: row.id, userId: row.userId, expiresAt: row.expiresAt, revokedAt: row.revokedAt };
}

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  async issue(input: IssueRefreshTokenInput): Promise<IssuedRefreshToken> {
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawToken);

    const created = await prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt: input.expiresAt,
        createdByIp: input.createdByIp,
      },
    });

    return { id: created.id, rawToken };
  }

  async findByRawToken(rawToken: string): Promise<RefreshTokenRecord | null> {
    const tokenHash = hashToken(rawToken);
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    return row ? toRecord(row) : null;
  }

  async revoke(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
