import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import { OtpVerificationRequiredError } from '../../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../../ports/ILoanSigningSessionRepository';
import { resolvePortalSigningSession } from './resolvePortalSigningSession';

/** 2026-08-20 (Portal e-signature, user request): Portal-authenticated counterpart of
 * `GetLoanSigningDocumentFileUseCase` - same "signed copy if already signed, else the original"
 * behavior, resolved by `sessionId + portalAccountId`. */
export class GetPortalSigningDocumentFileUseCase {
  constructor(
    private readonly deps: {
      loanSigningSessionRepository: ILoanSigningSessionRepository;
      portalAccountRepository: IPortalAccountRepository;
      loanAccountRepository: ILoanAccountRepository;
      generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
      fileStorage: IFileStorage;
    },
  ) {}

  async execute(sessionId: string, portalAccountId: string, signingDocumentId: string): Promise<Buffer> {
    const session = await resolvePortalSigningSession(sessionId, portalAccountId, this.deps);
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
