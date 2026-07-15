import { beforeEach, describe, expect, it, vi } from 'vitest';

const repaymentScheduleOps = { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() };
const prismaMock = {
  repaymentSchedule: repaymentScheduleOps,
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)),
};

vi.mock('@shared/database/prismaClient', () => ({ prisma: prismaMock }));

const { PrismaRepaymentInstallmentRepository } = await import(
  '@modules/repayment/infrastructure/PrismaRepaymentInstallmentRepository'
);
const { RepaymentInstallment } = await import('@modules/repayment/domain/RepaymentInstallment');
const { InstallmentAmounts } = await import('@modules/repayment/domain/valueObjects/InstallmentAmounts');
const { Money } = await import('@shared/domain/Money');
const { ConcurrencyConflictError } = await import('@shared/errors/DomainError');

function buildExistingInstallment(version: number) {
  return RepaymentInstallment.reconstitute({
    id: 'installment-1',
    loanAccountId: 'loan-1',
    installmentNumber: 1,
    dueDate: new Date(Date.now() + 86_400_000),
    due: InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }),
    paid: InstallmentAmounts.of({}),
    createdAt: new Date(),
    updatedAt: new Date(),
    version,
  });
}

describe('PrismaRepaymentInstallmentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save() writes the derived status into the persisted status column (new installment)', async () => {
    const installment = RepaymentInstallment.create({
      loanAccountId: 'loan-1',
      installmentNumber: 1,
      dueDate: new Date(Date.now() + 86_400_000),
      due: InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }),
    });
    installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }));

    const repo = new PrismaRepaymentInstallmentRepository();
    await repo.save(installment);

    expect(repaymentScheduleOps.create).toHaveBeenCalledTimes(1);
    const call = repaymentScheduleOps.create.mock.calls[0]?.[0];
    expect(call.data.status).toBe('PAID');
    expect(call.data.version).toBe(0);
    expect(repaymentScheduleOps.updateMany).not.toHaveBeenCalled();
  });

  // Milestone 9.1 checkpoint 6 / ADR-048-optimistic-concurrency.
  describe('conditional write (checkpoint 6)', () => {
    it('an existing installment is updated via a conditional WHERE id = ? AND version = ? guard, incrementing version', async () => {
      const installment = buildExistingInstallment(4);
      installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }));
      repaymentScheduleOps.updateMany.mockResolvedValue({ count: 1 });
      const repo = new PrismaRepaymentInstallmentRepository();

      await repo.save(installment);

      expect(repaymentScheduleOps.create).not.toHaveBeenCalled();
      expect(repaymentScheduleOps.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: installment.id, version: 4 },
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      );
    });

    it('throws ConcurrencyConflictError when the conditional update affects zero rows', async () => {
      const installment = buildExistingInstallment(4);
      repaymentScheduleOps.updateMany.mockResolvedValue({ count: 0 });
      const repo = new PrismaRepaymentInstallmentRepository();

      await expect(repo.save(installment)).rejects.toThrow(ConcurrencyConflictError);
    });
  });

  it('findByLoanAccountId orders by installmentNumber ascending', async () => {
    repaymentScheduleOps.findMany.mockResolvedValue([]);
    const repo = new PrismaRepaymentInstallmentRepository();

    await repo.findByLoanAccountId('loan-1');

    expect(repaymentScheduleOps.findMany).toHaveBeenCalledWith({
      where: { loanAccountId: 'loan-1' },
      orderBy: { installmentNumber: 'asc' },
      include: { penaltyOverrideBy: { select: { firstName: true, lastName: true } } },
    });
  });

  it('findById returns null when no row exists', async () => {
    repaymentScheduleOps.findUnique.mockResolvedValue(null);
    const repo = new PrismaRepaymentInstallmentRepository();
    await expect(repo.findById('missing')).resolves.toBeNull();
  });

  // Milestone 9.1 checkpoint 5 / ADR-048-optimistic-concurrency: version must
  // be hydrated from the persisted row into the domain object — this is
  // the one new piece of read-mapping behavior this checkpoint adds.
  it('findById hydrates version from the persisted row', async () => {
    const now = new Date();
    repaymentScheduleOps.findUnique.mockResolvedValue({
      id: 'installment-1',
      loanAccountId: 'loan-1',
      installmentNumber: 1,
      dueDate: now,
      principalDue: '800.00',
      interestDue: '200.00',
      feesDue: '0.00',
      penaltyDue: '0.00',
      principalPaid: '0.00',
      interestPaid: '0.00',
      feesPaid: '0.00',
      penaltyPaid: '0.00',
      status: 'PENDING',
      lastPaidAt: null,
      legacyId: null,
      createdAt: now,
      updatedAt: now,
      version: 2,
    });
    const repo = new PrismaRepaymentInstallmentRepository();

    const installment = await repo.findById('installment-1');

    expect(installment?.version).toBe(2);
  });

  // Audit finding C-2 (Milestone 7.1 remediation): saveMany() previously
  // issued its upserts as independent, unwrapped calls — a partial
  // failure mid-batch could leave a schedule half-written. These tests
  // prove the fix and would have caught the original bug (the "no
  // $transaction mock defined" pattern used pre-remediation would have
  // made a real call throw instead of silently passing).
  //
  // Milestone 9.1 checkpoint 6: the per-row write is now an explicit
  // create() (new installments) or a conditional updateMany() (existing
  // installments), never an unconditional upsert() — see `persistInstallment`
  // in PrismaRepaymentInstallmentRepository.ts.
  describe('saveMany (atomicity)', () => {
    function buildInstallment(installmentNumber: number) {
      return RepaymentInstallment.create({
        loanAccountId: 'loan-1',
        installmentNumber,
        dueDate: new Date(Date.now() + 86_400_000),
        due: InstallmentAmounts.of({ principal: Money.of('100.00') }),
      });
    }

    it('wraps the whole batch in a single prisma.$transaction when no outer ctx is supplied', async () => {
      const installments = [buildInstallment(1), buildInstallment(2), buildInstallment(3)];
      const repo = new PrismaRepaymentInstallmentRepository();

      await repo.saveMany(installments);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(repaymentScheduleOps.create).toHaveBeenCalledTimes(3);
    });

    it('rolls back — propagates the error — if any create in the batch fails', async () => {
      repaymentScheduleOps.create.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('constraint violation'));
      const installments = [buildInstallment(1), buildInstallment(2)];
      const repo = new PrismaRepaymentInstallmentRepository();

      await expect(repo.saveMany(installments)).rejects.toThrow('constraint violation');
    });

    it('a batch of new installments is INSERTed with version 0, not upserted', async () => {
      const installment = buildInstallment(1);
      const repo = new PrismaRepaymentInstallmentRepository();

      await repo.saveMany([installment]);

      expect(repaymentScheduleOps.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: installment.id, installmentNumber: 1, version: 0 }),
        }),
      );
      expect(repaymentScheduleOps.updateMany).not.toHaveBeenCalled();
    });

    it('rolls back — propagates ConcurrencyConflictError — if any row in the batch loses its version race', async () => {
      const staleInstallment = buildExistingInstallment(1);
      repaymentScheduleOps.updateMany.mockResolvedValue({ count: 0 });
      const repo = new PrismaRepaymentInstallmentRepository();

      await expect(repo.saveMany([staleInstallment])).rejects.toThrow(ConcurrencyConflictError);
    });

    it('joins an outer TransactionContext instead of opening a nested transaction', async () => {
      const { PrismaUnitOfWork } = await import('@shared/infrastructure/PrismaUnitOfWork');
      const unitOfWork = new PrismaUnitOfWork();
      const installments = [buildInstallment(1)];
      const repo = new PrismaRepaymentInstallmentRepository();

      await unitOfWork.run(async (ctx) => {
        vi.clearAllMocks(); // isolate from run()'s own $transaction call
        await repo.saveMany(installments, ctx);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(repaymentScheduleOps.create).toHaveBeenCalledTimes(1);
      });
    });
  });
});
