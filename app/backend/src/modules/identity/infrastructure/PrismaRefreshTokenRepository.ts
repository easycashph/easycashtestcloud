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

  async revoke(id: string): Promise<boolean> {
    // Audit finding C-01: a single atomic conditional UPDATE, not a
    // read-then-write. Postgres row-level locking guarantees that of any
    // number of concurrent callers targeting the same id, exactly one
    // `updateMany` call will find revokedAt still NULL and affect a row;
    // every other concurrent caller will find 0 rows affected. This is
    // what makes reuse detection reliable under concurrency — see
    // RefreshTokenUseCase for how the boolean result is used.
    const result = await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async rotate(oldTokenId: string, newToken: IssueRefreshTokenInput): Promise<IssuedRefreshToken | null> {
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawToken);

    // Production-readiness review finding: revoke-then-issue as two
    // independent calls left a window where a failure between them could
    // permanently revoke the old token without ever creating a
    // replacement (orphaned session / accidental logout on a transient
    // error). Wrapping both in one transaction closes that window: if
    // `create` throws for any reason, the `updateMany` above is rolled
    // back too, and the old token remains valid for the client to retry.
    //
    // The race-detection guarantee (C-01) is preserved: Postgres holds the
    // row lock acquired by `updateMany`'s UPDATE for the lifetime of the
    // transaction (standard READ COMMITTED behavior, no isolation-level
    // override needed), so a concurrent transaction targeting the same
    // oldTokenId blocks until this one commits or rolls back, then
    // re-evaluates `revokedAt: null` against the now-committed state —
    // exactly one concurrent caller can ever see `count === 1`.
    return prisma.$transaction(async (tx) => {
      const revokeResult = await tx.refreshToken.updateMany({
        where: { id: oldTokenId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revokeResult.count !== 1) {
        // Lost the claim — already revoked by a concurrent caller (or
        // doesn't exist). Nothing was changed by this transaction.
        return null;
      }

      const created = await tx.refreshToken.create({
        data: {
          userId: newToken.userId,
          tokenHash,
          expiresAt: newToken.expiresAt,
          createdByIp: newToken.createdByIp,
        },
      });

      return { id: created.id, rawToken };
    });
  }
}
