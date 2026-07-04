import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditLogOps = { create: vi.fn() };
const prismaMock = {
  auditLog: auditLogOps,
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaFinancialAuditLogger } = await import('@shared/infrastructure/PrismaFinancialAuditLogger');
const { PrismaUnitOfWork } = await import('@shared/infrastructure/PrismaUnitOfWork');

describe('PrismaFinancialAuditLogger (ADR-047-financial-audit-isolation: must fail closed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes an entry successfully under normal conditions', async () => {
    auditLogOps.create.mockResolvedValue({});
    const logger = new PrismaFinancialAuditLogger();

    await expect(
      logger.log({ action: 'LOAN_ACTIVATED', entityType: 'LoanAccount', entityId: 'loan-1' }),
    ).resolves.toBeUndefined();
    expect(auditLogOps.create).toHaveBeenCalledTimes(1);
    expect(auditLogOps.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'LOAN_ACTIVATED',
        entityType: 'LoanAccount',
        entityId: 'loan-1',
      }),
    });
  });

  it('PROPAGATES (does not swallow) an error when the underlying database write fails', async () => {
    auditLogOps.create.mockRejectedValue(new Error('connection timeout'));
    const logger = new PrismaFinancialAuditLogger();

    // The whole point of the fail-closed contract: this must reject, not
    // resolve, so a failing financial audit write always aborts the
    // transaction it's part of, instead of being silently observed and
    // discarded the way identity's fail-open logger discards it.
    await expect(
      logger.log({ action: 'LOAN_ACTIVATED', entityType: 'LoanAccount', entityId: 'loan-1' }),
    ).rejects.toThrow('connection timeout');
  });

  it('joins the caller-supplied IUnitOfWork transaction instead of opening its own', async () => {
    auditLogOps.create.mockResolvedValue({});
    const logger = new PrismaFinancialAuditLogger();
    const unitOfWork = new PrismaUnitOfWork();

    await unitOfWork.run(async (ctx) => {
      vi.clearAllMocks(); // isolate from run()'s own $transaction call
      await logger.log({ action: 'PAYMENT_RECORDED', entityType: 'LoanAccount', entityId: 'loan-2' }, ctx);

      // No nested transaction was opened — the write used the ctx's own
      // client, the same pattern every Prisma-backed repository follows.
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(auditLogOps.create).toHaveBeenCalledTimes(1);
    });
  });

  it('rolling back the outer transaction on a failed audit write is observable: the error propagates through IUnitOfWork.run()', async () => {
    auditLogOps.create.mockRejectedValue(new Error('connection timeout'));
    const logger = new PrismaFinancialAuditLogger();
    const unitOfWork = new PrismaUnitOfWork();

    // This is the fail-closed guarantee ADR-047-financial-audit-isolation §4
    // requires: a failing audit write, when it's one call among several
    // inside a financial use case's IUnitOfWork.run() block, must cause
    // that whole block to reject — which is what triggers Prisma's
    // transaction rollback of every other write in the same block.
    await expect(
      unitOfWork.run(async (ctx) => {
        await logger.log({ action: 'LOAN_ACTIVATED', entityType: 'LoanAccount', entityId: 'loan-3' }, ctx);
      }),
    ).rejects.toThrow('connection timeout');
  });
});
