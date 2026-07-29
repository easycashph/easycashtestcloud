import { NotFoundError } from '@shared/errors/DomainError';
import type { CoBorrower } from '../../domain/CoBorrower';
import type { ICoBorrowerRepository } from '../ports/ICoBorrowerRepository';

export interface GetCoBorrowerUseCaseDeps {
  coBorrowerRepository: ICoBorrowerRepository;
}

export class GetCoBorrowerUseCase {
  constructor(private readonly deps: GetCoBorrowerUseCaseDeps) {}

  async execute(id: string): Promise<CoBorrower> {
    const coBorrower = await this.deps.coBorrowerRepository.findById(id);
    if (!coBorrower) {
      throw new NotFoundError('CoBorrower', id);
    }
    return coBorrower;
  }
}
