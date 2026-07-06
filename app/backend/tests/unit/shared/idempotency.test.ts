import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { withIdempotency } from '@shared/http/idempotency';
import type { IIdempotencyKeyStore } from '@shared/application/ports/IIdempotencyKeyStore';

function buildStore(): IIdempotencyKeyStore & { find: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> } {
  return { find: vi.fn().mockResolvedValue(null), save: vi.fn() };
}

function buildRequest(headerValue: string | undefined): Request {
  return { header: vi.fn().mockReturnValue(headerValue) } as unknown as Request;
}

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

describe('withIdempotency (Milestone 9.1/9.2 CP13)', () => {
  it('runs execute() and responds normally when no Idempotency-Key header is sent', async () => {
    const store = buildStore();
    const req = buildRequest(undefined);
    const res = buildResponse();
    const execute = vi.fn().mockResolvedValue({ statusCode: 200, body: { ok: true } });

    await withIdempotency(store, req, res, 'POST /x', 'user-1', execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(store.find).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('runs execute() once and stores the result when a new Idempotency-Key is sent', async () => {
    const store = buildStore();
    const req = buildRequest('key-1');
    const res = buildResponse();
    const execute = vi.fn().mockResolvedValue({ statusCode: 200, body: { ok: true } });

    await withIdempotency(store, req, res, 'POST /x', 'user-1', execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledWith('key-1', 'POST /x', 'user-1', { statusCode: 200, responseBody: { ok: true } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('replays the stored response and never calls execute() when the key was already recorded', async () => {
    const store = buildStore();
    store.find.mockResolvedValue({ statusCode: 200, responseBody: { ok: true, replayed: true } });
    const req = buildRequest('key-1');
    const res = buildResponse();
    const execute = vi.fn();

    await withIdempotency(store, req, res, 'POST /x', 'user-1', execute);

    expect(execute).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, replayed: true });
  });

  it('does NOT store anything when execute() throws — a failed attempt must remain retryable with the same key', async () => {
    const store = buildStore();
    const req = buildRequest('key-1');
    const res = buildResponse();
    const execute = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withIdempotency(store, req, res, 'POST /x', 'user-1', execute)).rejects.toThrow('boom');

    expect(store.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
