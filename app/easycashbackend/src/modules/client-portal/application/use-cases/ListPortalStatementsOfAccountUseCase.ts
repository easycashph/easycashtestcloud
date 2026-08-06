import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IGeneratedStatementOfAccountRepository } from '@modules/statement-of-account/application/ports/IGeneratedStatementOfAccountRepository';
import type { PortalStatementOfAccountEntry } from '../dtos/PortalLoanAccountDtos';
import { PortalLoanAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface ListPortalStatementsOfAccountUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
  generatedStatementOfAccountRepository: IGeneratedStatementOfAccountRepository;
}

/**
 * "My Statement of Account" (2026-08-06 user request) - lets a client view/download the SOAs
 * staff has already generated for one of their own loan accounts. Deliberately VIEW-ONLY: a client
 * cannot generate a new SOA themselves (that flow takes fee/date parameters - collectionFee,
 * otherFee, penalty date range - a client has no business setting; only staff can). Ownership
 * check mirrors `ListPortalLoanAccountInstallmentsUseCase`'s exact pattern.
 */
export class ListPortalStatementsOfAccountUseCase {
  constructor(private readonly deps: ListPortalStatementsOfAccountUseCaseDeps) {}

  async execute(portalAccountId: string, loanAccountId: string): Promise<PortalStatementOfAccountEntry[]> {
    const { portalAccountRepository, loanAccountRepository, generatedStatementOfAccountRepository } = this.deps;

    const account = await portalAccountRepository.findById(portalAccountId);
    if (!account?.borrowerId) throw new PortalLoanAccountNotFoundError();

    const loanAccount = await loanAccountRepository.findById(loanAccountId);
    if (!loanAccount || loanAccount.borrowerId !== account.borrowerId) {
      throw new PortalLoanAccountNotFoundError();
    }

    const statements = await generatedStatementOfAccountRepository.findAllForLoanAccount(loanAccountId);
    return statements.map((statement) => ({
      id: statement.id,
      soaNumber: statement.soaNumber,
      totalAmountDue: statement.totalAmountDue,
      generatedAt: statement.generatedAt,
    }));
  }
}
