import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const idempotencyKeyOps = { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() };
const prismaMock = { idempotencyKey: idempotencyKeyOps };

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaIdempotencyKeyStore } = await import('@shared/infrastructure/PrismaIdempotencyKeyStore');

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.20.0',
  });
}

describe('PrismaIdempotencyKeyStore (Milestone 9.1/9.2 CP13, reworked 2026-07-08 for H-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('claim()', () => {
    it('returns CLAIMED and inserts a row with no response yet when the (key, endpoint) pair is new', async () => {
      idempotencyKeyOps.create.mockResolvedValue({});
      const store = new PrismaIdempotencyKeyStore();

      const result = await store.claim('key-1', 'POST /loan-accounts/:id/activate', 'user-1');

      expect(result).toEqual({ outcome: 'CLAIMED' });
      expect(idempotencyKeyOps.create).toHaveBeenCalledWith({
        data: { key: 'key-1', endpoint: 'POST /loan-accounts/:id/activate', userId: 'user-1' },
      });
      expect(idempotencyKeyOps.findUnique).not.toHaveBeenCalled();
    });

    it('returns COMPLETED with the stored response when the row already has one (a true replay)', async () => {
      idempotencyKeyOps.create.mockRejectedValue(uniqueConstraintError());
      idempotencyKeyOps.findUnique.mockResolvedValue({ statusCode: 200, responseBody: { id: 'loan-1', status: 'ACTIVE' } });
      const store = new PrismaIdempotencyKeyStore();

      const result = await store.claim('key-1', 'POST /loan-accounts/:id/activate', 'user-1');

      expect(result).toEqual({ outcome: 'COMPLETED', response: { statusCode: 200, responseBody: { id: 'loan-1', status: 'ACTIVE' } } });
    });

    it('returns IN_PROGRESS when the row exists but has no response yet (a genuinely concurrent duplicate)', async () => {
      idempotencyKeyOps.create.mockRejectedValue(uniqueConstraintError());
      idempotencyKeyOps.findUnique.mockResolvedValue({ statusCode: null, responseBody: null });
      const store = new PrismaIdempotencyKeyStore();

      const result = await store.claim('key-1', 'POST /loan-accounts/:id/activate', 'user-1');

      expect(result).toEqual({ outcome: 'IN_PROGRESS' });
    });

    it('rethrows any error that is not a unique-constraint violation', async () => {
      idempotencyKeyOps.create.mockRejectedValue(new Error('connection lost'));
      const store = new PrismaIdempotencyKeyStore();

      await expect(store.claim('key-1', 'POST /x', 'user-1')).rejects.toThrow('connection lost');
    });
  });

  describe('complete()', () => {
    it('updates the claimed row with the final statusCode and responseBody', async () => {
      idempotencyKeyOps.update.mockResolvedValue({});
      const store = new PrismaIdempotencyKeyStore();

      await store.complete('key-1', 'POST /loan-accounts/:id/payments', { statusCode: 200, responseBody: { remainder: '0.00' } });

      expect(idempotencyKeyOps.update).toHaveBeenCalledWith({
        where: { key_endpoint: { key: 'key-1', endpoint: 'POST /loan-accounts/:id/payments' } },
        data: { statusCode: 200, responseBody: { remainder: '0.00' } },
      });
    });
  });

  describe('release()', () => {
    it('deletes only the still-pending row for this (key, endpoint) pair', async () => {
      idempotencyKeyOps.deleteMany.mockResolvedValue({ count: 1 });
      const store = new PrismaIdempotencyKeyStore();

      await store.release('key-1', 'POST /loan-accounts/:id/activate');

      expect(idempotencyKeyOps.deleteMany).toHaveBeenCalledWith({
        where: { key: 'key-1', endpoint: 'POST /loan-accounts/:id/activate', statusCode: null },
      });
    });
  });
});
