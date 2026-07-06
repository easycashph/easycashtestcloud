import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { IIdempotencyKeyStore, StoredIdempotentResponse } from '../application/ports/IIdempotencyKeyStore';

/**
 * Milestone 9.1/9.2 CP13. Deliberately uses the plain `prisma` singleton
 * (not `resolveClient(ctx)`/`withTransaction`, unlike every financial
 * repository) — `find()` runs before the balance-mutating use case's own
 * `IUnitOfWork.run()` block even starts, and `save()` runs after that block
 * has already committed, so neither belongs inside that transaction.
 *
 * The compound-unique `(key, endpoint)` constraint (`schema.prisma`'s
 * `@@unique([key, endpoint])`) is what actually prevents a race between two
 * concurrent requests carrying the same key from both proceeding to the use
 * case layer: the second `save()` call for the same pair throws a Prisma
 * `P2002` unique-constraint violation, which is intentionally left
 * unhandled here — see `docs/PROJECT_HANDOFF.md` M-2 (Prisma exception
 * translation is a known, separately-tracked gap, not invented as a fix in
 * this file).
 */
export class PrismaIdempotencyKeyStore implements IIdempotencyKeyStore {
  async find(key: string, endpoint: string): Promise<StoredIdempotentResponse | null> {
    const row = await prisma.idempotencyKey.findUnique({
      where: { key_endpoint: { key, endpoint } },
    });
    if (!row) {
      return null;
    }
    return { statusCode: row.statusCode, responseBody: row.responseBody };
  }

  async save(key: string, endpoint: string, userId: string, response: StoredIdempotentResponse): Promise<void> {
    await prisma.idempotencyKey.create({
      data: {
        key,
        endpoint,
        userId,
        statusCode: response.statusCode,
        responseBody: response.responseBody as Prisma.InputJsonValue,
      },
    });
  }
}
