import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import { OtpVerificationRequiredError, SigningSessionExpiredError } from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import { hashSigningSecret } from '../../infrastructure/signingTokenHash';

export interface GetLoanSigningDocumentFileUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  fileStorage: IFileStorage;
}

/** Serves the signed PDF if this document has already been signed in this session, otherwise the
 * original generated (unsigned) PDF - so re-opening the link after signing shows proof of what
 * was actually signed, not the pre-signature version. */
export class GetLoanSigningDocumentFileUseCase {
  constructor(private readonly deps: GetLoanSigningDocumentFileUseCaseDeps) {}

  async execute(rawToken: string, signingDocumentId: string): Promise<Buffer> {
    const tokenHash = hashSigningSecret(rawToken);
    const session = await this.deps.loanSigningSessionRepository.findByTokenHash(tokenHash);
    if (!session || session.isExpiredOrRevoked()) throw new SigningSessionExpiredError();
    if (!session.isOtpVerifiedFresh()) throw new OtpVerificationRequiredError();

    const entry = session.findDocument(signingDocumentId);
    if (!entry) throw new NotFoundError('LoanSigningDocument', signingDocumentId);

    if (entry.signedStorageKey) {
      return this.deps.fileStorage.read(entry.signedStorageKey);
    }
    const generatedDoc = await this.deps.generatedLoanDocumentRepository.findById(entry.generatedLoanDocumentId);
    if (!generatedDoc) throw new NotFoundError('GeneratedLoanDocument', entry.generatedLoanDocumentId);
    return this.deps.fileStorage.read(generatedDoc.storageKey);
  }
}
