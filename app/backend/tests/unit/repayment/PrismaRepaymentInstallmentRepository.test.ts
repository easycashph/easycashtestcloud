import { beforeEach, describe, expect, it, vi } from 'vitest';

const repaymentScheduleOps = { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() };
const prismaMock = { repaymentSchedule: repaymentScheduleOps };

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
});
