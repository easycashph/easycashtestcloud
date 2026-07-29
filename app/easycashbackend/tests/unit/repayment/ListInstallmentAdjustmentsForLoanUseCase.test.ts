import { describe, expect, it, vi } from 'vitest';
import { ListInstallmentAdjustmentsForLoanUseCase } from '@modules/repayment/application/use-cases/ListInstallmentAdjustmentsForLoanUseCase';
import { Money } from '@shared/domain/Money';
import type { PenaltyReductionView } from '@modules/repayment/application/ports/IPenaltyReductionRepository';
import type { FeeAdjustmentView } from '@modules/repayment/application/ports/IFeeAdjustmentRepository';

function penaltyView(overrides: Partial<PenaltyReductionView> = {}): PenaltyReductionView {
  return {
    id: 'pr-1',
    repaymentInstallmentId: 'inst-1',
    installmentNumber: 4,
    installmentDueDate: new Date('2026-10-05T00:00:00Z'),
    previousPenaltyAmount: Money.of('1850.00'),
    newPenaltyAmount: Money.of('0.00'),
    reason: 'memo #1',
    reducedByUserId: 'user-1',
    reducedByName: 'J. Dela Cruz',
    createdAt: new Date('2026-07-15T10:00:00Z'),
    ...overrides,
  };
}

function feesView(overrides: Partial<FeeAdjustmentView> = {}): FeeAdjustmentView {
  return {
    id: 'fa-1',
    repaymentInstallmentId: 'inst-5',
    installmentNumber: 5,
    installmentDueDate: new Date('2026-11-05T00:00:00Z'),
    previousFeesAmount: Money.of('1101.47'),
    newFeesAmount: Money.of('500.00'),
    reason: 'memo #2',
    adjustedByUserId: 'user-2',
    adjustedByName: 'A. Santos',
    createdAt: new Date('2026-07-16T09:00:00Z'),
    ...overrides,
  };
}

describe('ListInstallmentAdjustmentsForLoanUseCase (2026-07-16, unified Payment History timeline)', () => {
  it('merges penalty reductions and fee adjustments, tagging each with its kind', async () => {
    const penaltyReductionRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue([penaltyView()]) };
    const feeAdjustmentRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue([feesView()]) };
    const useCase = new ListInstallmentAdjustmentsForLoanUseCase({ penaltyReductionRepository, feeAdjustmentRepository });

    const result = await useCase.execute('loan-1');

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.kind).sort()).toEqual(['FEE_ADJUSTMENT', 'PENALTY_REDUCTION']);
  });

  it('sorts the merged list newest first, across both kinds', async () => {
    const older = penaltyView({ createdAt: new Date('2026-07-14T00:00:00Z') });
    const newer = feesView({ createdAt: new Date('2026-07-16T00:00:00Z') });
    const penaltyReductionRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue([older]) };
    const feeAdjustmentRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue([newer]) };
    const useCase = new ListInstallmentAdjustmentsForLoanUseCase({ penaltyReductionRepository, feeAdjustmentRepository });

    const result = await useCase.execute('loan-1');

    expect(result[0]?.kind).toBe('FEE_ADJUSTMENT');
    expect(result[1]?.kind).toBe('PENALTY_REDUCTION');
  });

  it('returns an empty array when the loan has no adjustments of either kind', async () => {
    const penaltyReductionRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue([]) };
    const feeAdjustmentRepository = { create: vi.fn(), findByRepaymentInstallmentId: vi.fn(), findViewsByLoanAccountId: vi.fn().mockResolvedValue([]) };
    const useCase = new ListInstallmentAdjustmentsForLoanUseCase({ penaltyReductionRepository, feeAdjustmentRepository });

    await expect(useCase.execute('loan-1')).resolves.toEqual([]);
  });
});
