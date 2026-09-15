import { ValidationError } from '@shared/errors/DomainError';
import type { CreateNegativeAreaInput, INegativeAreaRepository, NegativeAreaEntry } from '../ports/INegativeAreaRepository';

export interface CreateNegativeAreaUseCaseDeps {
  negativeAreaRepository: INegativeAreaRepository;
}

export class CreateNegativeAreaUseCase {
  constructor(private readonly deps: CreateNegativeAreaUseCaseDeps) {}

  async execute(input: CreateNegativeAreaInput): Promise<NegativeAreaEntry> {
    const city = input.city.trim();
    const areaName = input.areaName.trim();
    if (!city || !areaName) throw new ValidationError('City and area name are both required.');

    return this.deps.negativeAreaRepository.create({ city, areaName });
  }
}
