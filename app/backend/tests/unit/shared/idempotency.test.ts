import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { withIdempotency } from '@shared/http/idempotency';
import type { IIdempotencyKeyStore } from '@shared/application/ports/IIdempotencyKeyStore';

function buildStore(): IIdempotencyKeyStore & {
  claim: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  return {
    claim: vi.fn().mockResolvedValue({ outcome: 'CLAIMED' }),
    complete: vi.fn(),
    release: vi.fn(),
  };
}

function buildRequest(headerValue: string | undefined): Request {
  return { header: vi.fn().mockReturnValue(headerValue) } as unknown as Request;
}

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('withIdempotency (Milestone 9.1/9.2 CP13, reworked 2026-07-08 for H-4)', () => {
  it('runs execute() and responds normally when no Idempotency-Key header is sent', async () => {
    const store = buildStore();
    const req = buildRequest(undefined);
    const res = buildResponse();
    const execute = vi.fn().mockResolvedValue({ statusCode: 200, body: { ok: true } });

    await withIdempotency(store, req, res, 'POST /x', 'user-1', execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(store.claim).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('claims the key, runs execute() once, and completes the claim when a new Idempotency-Key is sent', async () => {
    const store = buildStore();
    const req = buildRequest('key-1');
    const res = buildResponse();
    const execute = vi.fn().mockResolvedValue({ statusCode: 200, body: { ok: true } });

    await withIdempotency(store, req, res, 'POST /x', 'user-1', execute);

    expect(store.claim).toHaveBeenCalledWith('key-1', 'POST /x', 'user-1');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(store.complete).toHaveBeenCalledWith('key-1', 'POST /x', { statusCode: 200, responseBody: { ok: true } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('replays the stored response and never calls execute() when the claim reports COMPLETED', async () => {
    const store = buildStore();
    store.claim.mockResolvedValue({ outcome: 'COMPLETED', response: { statusCode: 200, responseBody: { ok: true, replayed: true } } });
    const req = buildRequest('key-1');
    const res = buildResponse();
    const execute = vi.fn();

    await withIdempotency(store, req, res, 'POST /x', 'user-1', execute);

    expect(execute).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, replayed: true });
  });

  it('responds 409 and never calls execute() when the claim reports IN_PROGRESS (a genuinely concurrent duplicate)', async () => {
    const store = buildStore();
    store.claim.mockResolvedValue({ outcome: 'IN_PROGRESS' });
    const req = buildRequest('key-1');
    const res = buildResponse();
    const execute = vi.fn();

    await withIdempotency(store, req, res, 'POST /x', 'user-1', execute);

    expect(execute).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'IDEMPOTENCY_KEY_IN_PROGRESS' }));
  });

  it('releases the claim and never completes it when execute() throws — a failed attempt must remain retryable with the same key', async () => {
    const store = buildStore();
    const req = buildRequest('key-1');
    const res = buildResponse();
    const execute = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withIdempotency(store, req, res, 'POST /x', 'user-1', execute)).rejects.toThrow('boom');

    expect(store.release).toHaveBeenCalledWith('key-1', 'POST /x');
    expect(store.complete).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
