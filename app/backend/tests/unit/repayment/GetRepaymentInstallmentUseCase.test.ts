import { describe, expect, it, vi } from 'vitest';
import { GetRepaymentInstallmentUseCase } from '@modules/repayment/application/use-cases/GetRepaymentInstallmentUseCase';
import { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import { InstallmentAmounts } from '@modules/repayment/domain/valueObjects/InstallmentAmounts';
import { Money } from '@shared/domain/Money';
import { NotFoundError } from '@shared/errors/DomainError';

function buildInstallment() {
  return RepaymentInstallment.create({
    loanAccountId: 'loan-1',
    installmentNumber: 1,
    dueDate: new Date(Date.now() + 86_400_000),
    due: InstallmentAmounts.of({ principal: Money.of('800.00'), interest: Money.of('200.00') }),
  });
}

describe('GetRepaymentInstallmentUseCase', () => {
  it('returns the installment when found', async () => {
    const installment = buildInstallment();
    const repaymentInstallmentRepository = { findById: vi.fn().mockResolvedValue(installment), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
    const useCase = new GetRepaymentInstallmentUseCase({ repaymentInstallmentRepository });

    await expect(useCase.execute(installment.id)).resolves.toBe(installment);
  });

  it('throws NotFoundError when the installment does not exist', async () => {
    const repaymentInstallmentRepository = { findById: vi.fn().mockResolvedValue(null), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
    const useCase = new GetRepaymentInstallmentUseCase({ repaymentInstallmentRepository });

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
