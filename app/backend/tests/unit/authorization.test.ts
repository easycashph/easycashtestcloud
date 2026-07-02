import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

/**
 * Milestone 8.1 remediation (audit finding H-3): router-level
 * authorization wiring (which middleware guards which route) previously
 * had zero test coverage — only the isolated `requireRole()` function and
 * isolated controller methods were tested, so nothing would catch a
 * future refactor accidentally dropping `requireRole(...)` from a
 * sensitive route.
 *
 * These tests hit `createApp()` directly via supertest, exercising the
 * REAL router wiring. Prisma is mocked (not a live database) so that
 * requests which pass the authorization gate resolve immediately and
 * deterministically — relying on a real Postgres connection attempt to
 * "fail fast" would make this file's timing environment-dependent
 * (a real network timeout on a firewalled/CI host can be much slower
 * than a local "connection refused"). `requireAuth`/`requireRole` still
 * reject before any repository call, so the 401/403 cases never touch
 * the mock either way.
 *
 * Only asserts the request was NOT rejected by the authorization layer
 * (not 401, not 403) for the "correct role" case — it does not assert
 * the request fully succeeds end-to-end, which is the opt-in integration
 * suite's job once a live database is available.
 */
const prismaMock = {
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
  borrower: { upsert: vi.fn().mockResolvedValue({}) },
  address: { count: vi.fn().mockResolvedValue(0) },
  loanAccount: { findUnique: vi.fn().mockResolvedValue(null) },
  loanProduct: { findUnique: vi.fn().mockResolvedValue(null) },
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { createApp } = await import('../../src/app');
const { JwtTokenService } = await import('@modules/identity/infrastructure/JwtTokenService');

const app = createApp();
const tokenService = new JwtTokenService();

function signToken(roles: string[]): string {
  return tokenService.signAccessToken({
    sub: 'user-1',
    email: 'test@easycash.ph',
    roles,
    branchId: 'branch-1',
    jti: 'jti-1',
  }).token;
}

const UNPRIVILEGED_ROLE = 'Viewer';

describe('Router-level authorization wiring (H-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.borrower.upsert.mockResolvedValue({});
    prismaMock.address.count.mockResolvedValue(0);
    prismaMock.loanAccount.findUnique.mockResolvedValue(null);
    prismaMock.loanProduct.findUnique.mockResolvedValue(null);
  });

  describe('POST /api/v1/borrowers (origination roles: Administrator, Manager, Loan Officer)', () => {
    const body = { branchId: 'branch-1', firstName: 'Juan', lastName: 'Dela Cruz' };

    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/borrowers').send(body);
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated user without an allowed role', async () => {
      const res = await request(app)
        .post('/api/v1/borrowers')
        .set('Authorization', `Bearer ${signToken([UNPRIVILEGED_ROLE])}`)
        .send(body);
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for an allowed role (Loan Officer)', async () => {
      const res = await request(app)
        .post('/api/v1/borrowers')
        .set('Authorization', `Bearer ${signToken(['Loan Officer'])}`)
        .send(body);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('POST /api/v1/loan-accounts/:id/approve (approval roles: Administrator, Manager only)', () => {
    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/loan-accounts/loan-1/approve');
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated Loan Officer (excluded from approval — separation of duties)', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/approve')
        .set('Authorization', `Bearer ${signToken(['Loan Officer'])}`);
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for Manager', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/approve')
        .set('Authorization', `Bearer ${signToken(['Manager'])}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(prismaMock.loanAccount.findUnique).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/loan-accounts/:id/reject (approval roles: Administrator, Manager only)', () => {
    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/loan-accounts/loan-1/reject').send({});
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated user without an allowed role', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/reject')
        .set('Authorization', `Bearer ${signToken([UNPRIVILEGED_ROLE])}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for Administrator', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/reject')
        .set('Authorization', `Bearer ${signToken(['Administrator'])}`)
        .send({ reason: 'Insufficient documents' });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('POST /api/v1/loan-products/:id/versions/:versionId/activate (product config roles: Administrator, Manager only)', () => {
    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/loan-products/product-1/versions/version-1/activate');
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated Loan Officer (excluded — product config is more sensitive than origination)', async () => {
      const res = await request(app)
        .post('/api/v1/loan-products/product-1/versions/version-1/activate')
        .set('Authorization', `Bearer ${signToken(['Loan Officer'])}`);
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for Administrator', async () => {
      const res = await request(app)
        .post('/api/v1/loan-products/product-1/versions/version-1/activate')
        .set('Authorization', `Bearer ${signToken(['Administrator'])}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(prismaMock.loanProduct.findUnique).toHaveBeenCalled();
    });
  });
});
