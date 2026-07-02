import { beforeEach, describe, expect, it, vi } from 'vitest';

const repaymentScheduleOps = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() };
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

describe('PrismaRepaymentInstallmentRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('save() writes the derived status into the persisted status column', async () => {
    const installment = RepaymentInstallment.create({
      loanAccountId: 'loan-1',
      installmentNumber: 1,
      dueDate: new Date(Date.now() + 86_400_000),
      due: InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }),
    });
    installment.recordPayment(InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }));

    const repo = new PrismaRepaymentInstallmentRepository();
    await repo.save(installment);

    expect(repaymentScheduleOps.upsert).toHaveBeenCalledTimes(1);
    const call = repaymentScheduleOps.upsert.mock.calls[0]?.[0];
    expect(call.create.status).toBe('PAID');
    expect(call.update.status).toBe('PAID');
  });

  it('findByLoanAccountId orders by installmentNumber ascending', async () => {
    repaymentScheduleOps.findMany.mockResolvedValue([]);
    const repo = new PrismaRepaymentInstallmentRepository();

    await repo.findByLoanAccountId('loan-1');

    expect(repaymentScheduleOps.findMany).toHaveBeenCalledWith({
      where: { loanAccountId: 'loan-1' },
      orderBy: { installmentNumber: 'asc' },
    });
  });

  it('findById returns null when no row exists', async () => {
    repaymentScheduleOps.findUnique.mockResolvedValue(null);
    const repo = new PrismaRepaymentInstallmentRepository();
    await expect(repo.findById('missing')).resolves.toBeNull();
  });

  // Audit finding C-2 (Milestone 7.1 remediation): saveMany() previously
  // issued its upserts as independent, unwrapped calls — a partial
  // failure mid-batch could leave a schedule half-written. These tests
  // prove the fix and would have caught the original bug (the "no
  // $transaction mock defined" pattern used pre-remediation would have
  // made a real call throw instead of silently passing).
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
      expect(repaymentScheduleOps.upsert).toHaveBeenCalledTimes(3);
    });

    it('rolls back — propagates the error — if any upsert in the batch fails', async () => {
      repaymentScheduleOps.upsert
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('constraint violation'));
      const installments = [buildInstallment(1), buildInstallment(2)];
      const repo = new PrismaRepaymentInstallmentRepository();

      await expect(repo.saveMany(installments)).rejects.toThrow('constraint violation');
    });

    it('existing per-row upsert shape is unchanged — still upserts by id with create/update payloads', async () => {
      const installment = buildInstallment(1);
      const repo = new PrismaRepaymentInstallmentRepository();

      await repo.saveMany([installment]);

      expect(repaymentScheduleOps.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: installment.id },
          create: expect.objectContaining({ id: installment.id }),
          update: expect.objectContaining({ installmentNumber: 1 }),
        }),
      );
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
        expect(repaymentScheduleOps.upsert).toHaveBeenCalledTimes(1);
      });
    });
  });
});
