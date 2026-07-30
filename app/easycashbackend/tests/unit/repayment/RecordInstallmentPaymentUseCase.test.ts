import { describe, expect, it, vi } from 'vitest';
import { RecordInstallmentPaymentUseCase } from '@modules/repayment/application/use-cases/RecordInstallmentPaymentUseCase';
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

describe('RecordInstallmentPaymentUseCase', () => {
  it('applies the payment to the found installment and saves it', async () => {
    const installment = buildInstallment();
    const repaymentInstallmentRepository = { findById: vi.fn().mockResolvedValue(installment), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
    const useCase = new RecordInstallmentPaymentUseCase({ repaymentInstallmentRepository });

    await useCase.execute({ installmentId: installment.id, principal: '800.00', interest: '200.00' });

    expect(installment.status).toBe('PAID');
    expect(repaymentInstallmentRepository.save).toHaveBeenCalledWith(installment);
  });

  it('throws NotFoundError for an unknown installment id', async () => {
    const repaymentInstallmentRepository = { findById: vi.fn().mockResolvedValue(null), findByLoanAccountId: vi.fn(), save: vi.fn(), saveMany: vi.fn() };
    const useCase = new RecordInstallmentPaymentUseCase({ repaymentInstallmentRepository });

    await expect(useCase.execute({ installmentId: 'missing' })).rejects.toThrow(NotFoundError);
  });
});
