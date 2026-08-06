import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IGeneratedStatementOfAccountRepository } from '@modules/statement-of-account/application/ports/IGeneratedStatementOfAccountRepository';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import { PortalLoanAccountNotFoundError } from '../../domain/errors/PortalAuthErrors';

export interface PortalStatementOfAccountFile {
  fileName: string;
  buffer: Buffer;
}

export interface DownloadPortalStatementOfAccountUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
  generatedStatementOfAccountRepository: IGeneratedStatementOfAccountRepository;
  fileStorage: IFileStorage;
}

/** Same ownership-then-cross-check shape as the staff-facing `StatementOfAccountController.download`
 * (loan account belongs to this client's Borrower, AND the requested statement belongs to that
 * loan account) - mirrors, rather than reuses, `GetGeneratedStatementOfAccountFileUseCase` since
 * that one has no concept of a requesting Borrower to check ownership against. */
export class DownloadPortalStatementOfAccountUseCase {
  constructor(private readonly deps: DownloadPortalStatementOfAccountUseCaseDeps) {}

  async execute(portalAccountId: string, loanAccountId: string, generatedStatementOfAccountId: string): Promise<PortalStatementOfAccountFile> {
    const { portalAccountRepository, loanAccountRepository, generatedStatementOfAccountRepository, fileStorage } = this.deps;

    const account = await portalAccountRepository.findById(portalAccountId);
    if (!account?.borrowerId) throw new PortalLoanAccountNotFoundError();

    const loanAccount = await loanAccountRepository.findById(loanAccountId);
    if (!loanAccount || loanAccount.borrowerId !== account.borrowerId) {
      throw new PortalLoanAccountNotFoundError();
    }

    const statement = await generatedStatementOfAccountRepository.findById(generatedStatementOfAccountId);
    if (!statement || statement.loanAccountId !== loanAccountId) {
      throw new PortalLoanAccountNotFoundError();
    }

    const buffer = await fileStorage.read(statement.storageKey);
    const dateStamp = statement.generatedAt.toISOString().slice(0, 10);
    return { fileName: `Statement of Account - ${dateStamp}.pdf`, buffer };
  }
}
