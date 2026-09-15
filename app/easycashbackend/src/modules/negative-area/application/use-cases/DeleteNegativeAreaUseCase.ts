import type { INegativeAreaRepository } from '../ports/INegativeAreaRepository';

export interface DeleteNegativeAreaUseCaseDeps {
  negativeAreaRepository: INegativeAreaRepository;
}

export class DeleteNegativeAreaUseCase {
  constructor(private readonly deps: DeleteNegativeAreaUseCaseDeps) {}

  async execute(id: string): Promise<void> {
    await this.deps.negativeAreaRepository.delete(id);
  }
}
