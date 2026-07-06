import type { Request, Response } from 'express';
import type { IIdempotencyKeyStore } from '@shared/application/ports/IIdempotencyKeyStore';

const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * Milestone 9.1/9.2 CP13
 * (`docs/Architecture/MILESTONE_9_IMPLEMENTATION_ROADMAP_V2.md`, Decision Log
 * #9). Wraps a balance-mutating controller action: if the client sent an
 * `Idempotency-Key` header already recorded against this exact `endpoint`,
 * the previously-stored response is replayed verbatim and `execute` never
 * runs again. Otherwise `execute` runs once, and — only on success — its
 * result is stored before being sent, so a client retry with the same key
 * gets the identical response instead of a second balance-mutating write.
 *
 * Deliberately does NOT store a response for a thrown error: `execute`'s
 * rejection propagates to the caller's own `try/catch { next(error) }`
 * untouched, so a transient failure can still be retried with the same key
 * (an idempotency key means "this exact successful effect happens once,"
 * not "this exact HTTP call happens once" — see CP13 roadmap note).
 *
 * A missing `Idempotency-Key` header is not an error — the client simply
 * gets no duplicate-resubmission protection for that call, same as any
 * client that doesn't yet send the header.
 */
export async function withIdempotency<T>(
  store: IIdempotencyKeyStore,
  req: Request,
  res: Response,
  endpoint: string,
  userId: string,
  execute: () => Promise<{ statusCode: number; body: T }>,
): Promise<void> {
  const key = req.header(IDEMPOTENCY_KEY_HEADER);

  if (key) {
    const existing = await store.find(key, endpoint);
    if (existing) {
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }
  }

  const { statusCode, body } = await execute();

  if (key) {
    await store.save(key, endpoint, userId, { statusCode, responseBody: body });
  }

  res.status(statusCode).json(body);
}
