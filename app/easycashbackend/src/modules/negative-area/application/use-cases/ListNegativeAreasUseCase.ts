import type { INegativeAreaRepository, NegativeAreaEntry } from '../ports/INegativeAreaRepository';

export interface ListNegativeAreasUseCaseDeps {
  negativeAreaRepository: INegativeAreaRepository;
}

export class ListNegativeAreasUseCase {
  constructor(private readonly deps: ListNegativeAreasUseCaseDeps) {}

  async execute(): Promise<NegativeAreaEntry[]> {
    return this.deps.negativeAreaRepository.list();
  }
}
