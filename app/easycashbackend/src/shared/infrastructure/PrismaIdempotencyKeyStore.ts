import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { IIdempotencyKeyStore, IdempotencyClaim, StoredIdempotentResponse } from '../application/ports/IIdempotencyKeyStore';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Milestone 9.1/9.2 CP13, reworked 2026-07-08 (H-4 fix). Deliberately uses
 * the plain `prisma` singleton (not `resolveClient(ctx)`/`withTransaction`,
 * unlike every financial repository) — `claim()` runs before the
 * balance-mutating use case's own `IUnitOfWork.run()` block even starts, and
 * `complete()`/`release()` run after that block has already committed or
 * thrown, so none of the three belong inside that transaction.
 *
 * The compound-unique `(key, endpoint)` constraint (`schema.prisma`'s
 * `@@unique([key, endpoint])`) is what actually prevents a race between two
 * concurrent requests carrying the same key: `claim()`'s own `create()` is
 * the first write either request makes, so the second one's `create()` hits
 * `P2002` *before* its caller ever runs the use case — not after, as the
 * prior `find()`-then-`save()` shape did.
 */
export class PrismaIdempotencyKeyStore implements IIdempotencyKeyStore {
  async claim(key: string, endpoint: string, userId: string): Promise<IdempotencyClaim> {
    try {
      await prisma.idempotencyKey.create({ data: { key, endpoint, userId } });
      return { outcome: 'CLAIMED' };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== UNIQUE_CONSTRAINT_VIOLATION) {
        throw error;
      }
      const existing = await prisma.idempotencyKey.findUnique({ where: { key_endpoint: { key, endpoint } } });
      if (existing && existing.statusCode !== null && existing.responseBody !== null) {
        return { outcome: 'COMPLETED', response: { statusCode: existing.statusCode, responseBody: existing.responseBody } };
      }
      return { outcome: 'IN_PROGRESS' };
    }
  }

  async complete(key: string, endpoint: string, response: StoredIdempotentResponse): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { key_endpoint: { key, endpoint } },
      data: {
        statusCode: response.statusCode,
        responseBody: response.responseBody as Prisma.InputJsonValue,
      },
    });
  }

  async release(key: string, endpoint: string): Promise<void> {
    // Scoped to `statusCode: null` so this can never remove an
    // already-`complete()`d row, even if called out of order.
    await prisma.idempotencyKey.deleteMany({ where: { key, endpoint, statusCode: null } });
  }
}
