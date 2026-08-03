import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { PortalInstallmentEntry } from '../dtos/PortalLoanAccountDtos';
import { PortalLoanAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface ListPortalLoanAccountInstallmentsUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
}

/** Backs the payment history / amortization schedule view for one of the client's own loan
 * accounts (2026-07-31 user request). Ownership is checked against the account's linked
 * `borrowerId`, not the loan account id alone - the same "reused error, no existence leak" pattern
 * every other portal ownership check in this module follows. */
export class ListPortalLoanAccountInstallmentsUseCase {
  constructor(private readonly deps: ListPortalLoanAccountInstallmentsUseCaseDeps) {}

  async execute(portalAccountId: string, loanAccountId: string): Promise<PortalInstallmentEntry[]> {
    const account = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!account?.borrowerId) throw new PortalLoanAccountNotFoundError();

    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount || loanAccount.borrowerId !== account.borrowerId) {
      throw new PortalLoanAccountNotFoundError();
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(loanAccountId);
    return installments
      .sort((a, b) => a.installmentNumber - b.installmentNumber)
      .map((installment) => ({
        installmentNumber: installment.installmentNumber,
        dueDate: installment.dueDate,
        principalDue: installment.due.principal.toString(),
        interestDue: installment.due.interest.toString(),
        feesDue: installment.due.fees.toString(),
        penaltyDue: installment.due.penalty.toString(),
        totalDue: installment.due.total().toString(),
        totalPaid: installment.paid.total().toString(),
        status: installment.status,
        lastPaidAt: installment.lastPaidAt ?? null,
      }));
  }
}
