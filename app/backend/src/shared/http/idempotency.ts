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
 * Deliberately does NOT store a response for a thrown error: on failure the
 * claim is released so a retry with the same key can run `execute` again (an
 * idempotency key means "this exact successful effect happens once," not
 * "this exact HTTP call happens once" — see CP13 roadmap note).
 *
 * A missing `Idempotency-Key` header is not an error — the client simply
 * gets no duplicate-resubmission protection for that call, same as any
 * client that doesn't yet send the header.
 *
 * 2026-07-08 (H-4 fix): the key is now `claim()`ed — a row inserted, with no
 * unique-constraint check beforehand — *before* `execute()` runs, not looked
 * up and stored only after. A genuinely concurrent second request with the
 * same key now collides with the DB's unique constraint at claim time and
 * gets a `409` telling it to retry, instead of racing `execute()` to
 * completion alongside the first request (which could double-apply a
 * payment or a disbursement before either write ever failed).
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

  if (!key) {
    const { statusCode, body } = await execute();
    res.status(statusCode).json(body);
    return;
  }

  const claim = await store.claim(key, endpoint, userId);

  if (claim.outcome === 'COMPLETED') {
    res.status(claim.response.statusCode).json(claim.response.responseBody);
    return;
  }

  if (claim.outcome === 'IN_PROGRESS') {
    res.status(409).json({
      code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
      message: 'A request with this Idempotency-Key is already being processed. Retry shortly.',
    });
    return;
  }

  try {
    const { statusCode, body } = await execute();
    await store.complete(key, endpoint, { statusCode, responseBody: body });
    res.status(statusCode).json(body);
  } catch (error) {
    await store.release(key, endpoint);
    throw error;
  }
}
