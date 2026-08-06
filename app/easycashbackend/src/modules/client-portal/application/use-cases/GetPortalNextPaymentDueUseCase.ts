import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { RepaymentInstallment } from '@modules/repayment/domain/RepaymentInstallment';
import type { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import type { PortalNextPaymentDue } from '../dtos/PortalLoanAccountDtos';

/** Mirrors the LMS's own open-loan definition (see e.g. CreateLoanApplicationUseCase's
 * CLOSED_LOAN_ACCOUNT_STATUSES / ClientProfilePage's ACTIVE_LOAN_STATUSES, inverted here). */
const OPEN_LOAN_ACCOUNT_STATUSES = new Set(['ACTIVE', 'ACTIVE_IN_ARREARS']);
const UNPAID_INSTALLMENT_STATUSES = new Set(['PENDING', 'PARTIALLY_PAID', 'LATE']);

export interface GetPortalNextPaymentDueUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
}

/**
 * Dashboard "Next Payment Due" reminder (2026-08-06 user request) - the soonest unpaid installment
 * across every one of the client's still-open loan accounts, so they see it at a glance instead of
 * having to open each loan's payment schedule individually. Returns `null` (not an error) whenever
 * there is genuinely nothing upcoming - no linked Borrower, no open loan, or (rare) every
 * installment on every open loan already paid.
 */
export class GetPortalNextPaymentDueUseCase {
  constructor(private readonly deps: GetPortalNextPaymentDueUseCaseDeps) {}

  async execute(portalAccountId: string): Promise<PortalNextPaymentDue | null> {
    const { portalAccountRepository, loanAccountRepository, repaymentInstallmentRepository } = this.deps;

    const account = await portalAccountRepository.findById(portalAccountId);
    if (!account?.borrowerId) return null;

    const allLoanAccounts = await loanAccountRepository.findMany({ borrowerId: account.borrowerId, limit: 200 });
    const openLoanAccounts = allLoanAccounts.filter((loanAccount) => OPEN_LOAN_ACCOUNT_STATUSES.has(loanAccount.status));
    if (openLoanAccounts.length === 0) return null;

    const perLoanCandidates = await Promise.all(
      openLoanAccounts.map(async (loanAccount) => {
        const installments = await repaymentInstallmentRepository.findByLoanAccountId(loanAccount.id);
        return installments
          .filter((installment) => UNPAID_INSTALLMENT_STATUSES.has(installment.status))
          .map((installment) => ({ installment, loanAccount }));
      }),
    );

    const candidates: { installment: RepaymentInstallment; loanAccount: LoanAccount }[] = perLoanCandidates.flat();
    if (candidates.length === 0) return null;

    const earliest = candidates.reduce((soonest, candidate) =>
      candidate.installment.dueDate.getTime() < soonest.installment.dueDate.getTime() ? candidate : soonest,
    );

    return {
      loanAccountId: earliest.loanAccount.id,
      loanCode: earliest.loanAccount.loanCode,
      installmentNumber: earliest.installment.installmentNumber,
      dueDate: earliest.installment.dueDate,
      totalDue: earliest.installment.due.total().toString(),
      totalPaid: earliest.installment.paid.total().toString(),
      status: earliest.installment.status,
    };
  }
}
