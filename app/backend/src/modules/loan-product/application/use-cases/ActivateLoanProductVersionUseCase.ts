import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanProductRepository } from '../ports/ILoanProductRepository';

export interface ActivateLoanProductVersionUseCaseDeps {
  loanProductRepository: ILoanProductRepository;
}

/**
 * The only sanctioned entry point for flipping LPV-2's "which version is
 * Active" state (ADR-042 §4) — delegates to `LoanProduct.activateVersion()`,
 * which deactivates the current active version and activates the target as
 * one in-memory operation before the whole product graph is saved.
 */
export class ActivateLoanProductVersionUseCase {
  constructor(private readonly deps: ActivateLoanProductVersionUseCaseDeps) {}

  async execute(loanProductId: string, versionId: string): Promise<void> {
    const product = await this.deps.loanProductRepository.findById(loanProductId);
    if (!product) {
      throw new NotFoundError('LoanProduct', loanProductId);
    }

    product.activateVersion(versionId);
    await this.deps.loanProductRepository.save(product);
  }
}
