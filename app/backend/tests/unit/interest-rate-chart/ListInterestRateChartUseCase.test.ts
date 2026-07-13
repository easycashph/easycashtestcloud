import { describe, expect, it, vi } from 'vitest';
import { ListInterestRateChartUseCase } from '@modules/interest-rate-chart/application/use-cases/ListInterestRateChartUseCase';
import type { IInterestRateChartRepository } from '@modules/interest-rate-chart/application/ports/IInterestRateChartRepository';

describe('ListInterestRateChartUseCase', () => {
  it('returns whatever the repository provides, unmodified', async () => {
    const entries = [
      { id: 'a', addOnRatePercent: '3.000', termMonths: 1, contractualRatePercent: '3.000' },
      { id: 'b', addOnRatePercent: '3.000', termMonths: 2, contractualRatePercent: '3.980' },
    ];
    const interestRateChartRepository: IInterestRateChartRepository = { findAll: vi.fn().mockResolvedValue(entries) };
    const useCase = new ListInterestRateChartUseCase({ interestRateChartRepository });

    const result = await useCase.execute();

    expect(result).toEqual(entries);
    expect(interestRateChartRepository.findAll).toHaveBeenCalledOnce();
  });
});
