import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';

export interface GetSignedLoanSigningDocumentFileUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  fileStorage: IFileStorage;
}

/** Staff-side (authenticated) counterpart to the public `GetLoanSigningDocumentFileUseCase` - lets
 * MIS/loan officers view the actual signed PDF (signature + audit line stamped in) from the Loan
 * Account page, without needing the client's own SMS link. Only ever serves a document that has
 * already been signed - a not-yet-signed entry has no `signedStorageKey` to read. */
export class GetSignedLoanSigningDocumentFileUseCase {
  constructor(private readonly deps: GetSignedLoanSigningDocumentFileUseCaseDeps) {}

  async execute(loanAccountId: string, sessionId: string, documentId: string): Promise<Buffer> {
    const session = await this.deps.loanSigningSessionRepository.findById(sessionId);
    if (!session || session.loanAccountId !== loanAccountId) throw new NotFoundError('LoanSigningSession', sessionId);

    const entry = session.findDocument(documentId);
    if (!entry || !entry.signedStorageKey) throw new NotFoundError('LoanSigningDocument', documentId);

    return this.deps.fileStorage.read(entry.signedStorageKey);
  }
}
