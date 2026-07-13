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

// ADR-038 §3.1 (business-confirmed, 2026-07-06): Collection Officer has no
// write access anywhere in the origination/approval/product-config surface —
// the correct "definitely excluded from everything" role for negative tests.
const UNPRIVILEGED_ROLE = 'Collection Officer';

describe('Router-level authorization wiring (H-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.borrower.upsert.mockResolvedValue({});
    prismaMock.address.count.mockResolvedValue(0);
    prismaMock.loanAccount.findUnique.mockResolvedValue(null);
    prismaMock.loanProduct.findUnique.mockResolvedValue(null);
  });

  describe('POST /api/v1/borrowers (origination roles: MIS, Loan Operation Manager, CRM)', () => {
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

    it('passes the authorization gate for an allowed role (CRM)', async () => {
      const res = await request(app)
        .post('/api/v1/borrowers')
        .set('Authorization', `Bearer ${signToken(['CRM'])}`)
        .send(body);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('POST /api/v1/loan-accounts/:id/approve (approval roles: MIS, Loan Operation Manager, CRM)', () => {
    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/loan-accounts/loan-1/approve');
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated user without an allowed role', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/approve')
        .set('Authorization', `Bearer ${signToken([UNPRIVILEGED_ROLE])}`);
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for Loan Operation Manager', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/approve')
        .set('Authorization', `Bearer ${signToken(['Loan Operation Manager'])}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(prismaMock.loanAccount.findUnique).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/loan-accounts/:id/reject (approval roles: MIS, Loan Operation Manager, CRM)', () => {
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

    it('passes the authorization gate for MIS', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/reject')
        .set('Authorization', `Bearer ${signToken(['MIS'])}`)
        .send({ reason: 'Insufficient documents' });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe('POST /api/v1/loan-products/:id/versions/:versionId/activate (product config roles: MIS, Loan Operation Manager, Finance, Accounting)', () => {
    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/loan-products/product-1/versions/version-1/activate');
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated CRM user (excluded — product config is Finance/Accounting responsibility, not loan-processing, per ADR-038 §3.1, even though CRM is included in origination)', async () => {
      const res = await request(app)
        .post('/api/v1/loan-products/product-1/versions/version-1/activate')
        .set('Authorization', `Bearer ${signToken(['CRM'])}`);
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for MIS', async () => {
      const res = await request(app)
        .post('/api/v1/loan-products/product-1/versions/version-1/activate')
        .set('Authorization', `Bearer ${signToken(['MIS'])}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(prismaMock.loanProduct.findUnique).toHaveBeenCalled();
    });
  });

  // Milestone 9.1/9.2 CP13, ADR-038 §3.6.
  describe('POST /api/v1/loan-accounts/:id/activate (activation roles: MIS, Loan Operation Manager, CRM)', () => {
    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/loan-accounts/loan-1/activate');
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated user without an allowed role', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/activate')
        .set('Authorization', `Bearer ${signToken([UNPRIVILEGED_ROLE])}`);
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for CRM', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/activate')
        .set('Authorization', `Bearer ${signToken(['CRM'])}`);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(prismaMock.loanAccount.findUnique).toHaveBeenCalled();
    });
  });

  // Milestone 9.1/9.2 CP13, ADR-038 §3.6.
  describe('POST /api/v1/loan-accounts/:id/payments (payment recording roles: MIS, Loan Operation Manager, Accounting, Collection Officer)', () => {
    it('rejects with 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/loan-accounts/loan-1/payments').send({ paymentAmount: '500.00', orNumber: 'OR-TEST-1' });
      expect(res.status).toBe(401);
    });

    it('rejects with 403 for an authenticated CRM user (excluded — payment recording is a financial-recording/collections function, not loan-processing, per ADR-038 §3.6, even though CRM is included in origination/approval/activation)', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/payments')
        .set('Authorization', `Bearer ${signToken(['CRM'])}`)
        .send({ paymentAmount: '500.00', orNumber: 'OR-TEST-1' });
      expect(res.status).toBe(403);
    });

    it('passes the authorization gate for Collection Officer', async () => {
      const res = await request(app)
        .post('/api/v1/loan-accounts/loan-1/payments')
        .set('Authorization', `Bearer ${signToken(['Collection Officer'])}`)
        .send({ paymentAmount: '500.00', orNumber: 'OR-TEST-1' });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(prismaMock.loanAccount.findUnique).toHaveBeenCalled();
    });
  });
});
