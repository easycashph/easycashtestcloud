import { NotFoundError } from '@shared/errors/DomainError';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { ILoanAccountRepository } from '../ports/ILoanAccountRepository';
import { LoanRiskAssessmentService, type LoanRiskAssessment } from '../services/LoanRiskAssessmentService';

export interface GetLoanRiskAssessmentUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
  riskAssessmentService: LoanRiskAssessmentService;
}

export class GetLoanRiskAssessmentUseCase {
  constructor(private readonly deps: GetLoanRiskAssessmentUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<LoanRiskAssessment> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) {
      throw new NotFoundError('LoanAccount', loanAccountId);
    }
    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
    return this.deps.riskAssessmentService.assess({ status: loanAccount.status, installments });
  }
}
