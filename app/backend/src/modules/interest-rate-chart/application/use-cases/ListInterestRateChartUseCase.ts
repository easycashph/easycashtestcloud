import type { IInterestRateChartRepository, InterestRateChartEntry } from '../ports/IInterestRateChartRepository';

export interface ListInterestRateChartUseCaseDeps {
  interestRateChartRepository: IInterestRateChartRepository;
}

export class ListInterestRateChartUseCase {
  constructor(private readonly deps: ListInterestRateChartUseCaseDeps) {}

  async execute(): Promise<InterestRateChartEntry[]> {
    return this.deps.interestRateChartRepository.findAll();
  }
}
