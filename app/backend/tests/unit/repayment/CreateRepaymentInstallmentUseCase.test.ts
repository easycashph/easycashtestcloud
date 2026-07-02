import { describe, expect, it, vi } from 'vitest';
import { CreateRepaymentInstallmentUseCase } from '@modules/repayment/application/use-cases/CreateRepaymentInstallmentUseCase';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';

describe('CreateRepaymentInstallmentUseCase', () => {
  it('creates a PENDING installment with the given due amounts', async () => {
    const repaymentInstallmentRepository: IRepaymentInstallmentRepository = {
      findById: vi.fn(),
      findByLoanAccountId: vi.fn(),
      save: vi.fn(),
      saveMany: vi.fn(),
    };
    const useCase = new CreateRepaymentInstallmentUseCase({ repaymentInstallmentRepository });

    const installment = await useCase.execute({
      loanAccountId: 'loan-1',
      installmentNumber: 1,
      dueDate: new Date(Date.now() + 86_400_000),
      principalDue: '800.00',
      interestDue: '200.00',
    });

    expect(installment.status).toBe('PENDING');
    expect(repaymentInstallmentRepository.save).toHaveBeenCalledWith(installment);
  });
});
