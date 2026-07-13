import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';
import { BorrowerRiskSummaryService, type BorrowerRiskSummary, type BorrowerLoanInput } from '../services/BorrowerRiskSummaryService';

export interface GetBorrowerRiskSummaryUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  riskSummaryService: BorrowerRiskSummaryService;
}

const MAX_LOANS_PER_BORROWER = 500;

export class GetBorrowerRiskSummaryUseCase {
  constructor(private readonly deps: GetBorrowerRiskSummaryUseCaseDeps) {}

  async execute(borrowerId: string): Promise<BorrowerRiskSummary> {
    const borrower = await this.deps.borrowerRepository.findById(borrowerId);
    if (!borrower) {
      throw new NotFoundError('Borrower', borrowerId);
    }

    const loanAccounts = await this.deps.loanAccountRepository.findMany({ borrowerId, limit: MAX_LOANS_PER_BORROWER });
    const loans: BorrowerLoanInput[] = await Promise.all(
      loanAccounts.map(async (loan) => ({
        status: loan.status,
        collectionsBalance: loan.collectionsBalance,
        installments: await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loan.id),
      })),
    );

    return this.deps.riskSummaryService.summarize(loans);
  }
}
