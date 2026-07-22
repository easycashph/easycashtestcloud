import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import {
  ConsentRequiredError,
  OtpVerificationRequiredError,
  SigningSessionExpiredError,
} from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import type { IDocumentSignatureStamper } from '../ports/IDocumentSignatureStamper';
import { hashSigningSecret } from '../../infrastructure/signingTokenHash';

export interface SignLoanSigningDocumentInput {
  rawToken: string;
  signingDocumentId: string;
  consentChecked: boolean;
  signatureImagePng: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SignLoanSigningDocumentUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  loanAccountRepository: ILoanAccountRepository;
  borrowerRepository: IBorrowerRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  fileStorage: IFileStorage;
  signatureStamper: IDocumentSignatureStamper;
}

/** Stamps the signature + audit line (name, timestamp, IP) onto a NEW PDF (the original
 * `GeneratedLoanDocument`'s file is never modified) and records the completion on the session.
 * Every precondition - OTP freshness, consent checkbox, not-already-signed - is checked here,
 * never trusted from the client alone. */
export class SignLoanSigningDocumentUseCase {
  constructor(private readonly deps: SignLoanSigningDocumentUseCaseDeps) {}

  async execute(input: SignLoanSigningDocumentInput): Promise<void> {
    if (!input.consentChecked) throw new ConsentRequiredError();

    const tokenHash = hashSigningSecret(input.rawToken);
    const session = await this.deps.loanSigningSessionRepository.findByTokenHash(tokenHash);
    if (!session || session.isExpiredOrRevoked()) throw new SigningSessionExpiredError();
    if (!session.isOtpVerifiedFresh()) throw new OtpVerificationRequiredError();

    const entry = session.findDocument(input.signingDocumentId);
    if (!entry) throw new NotFoundError('LoanSigningDocument', input.signingDocumentId);

    const generatedDoc = await this.deps.generatedLoanDocumentRepository.findById(entry.generatedLoanDocumentId);
    if (!generatedDoc) throw new NotFoundError('GeneratedLoanDocument', entry.generatedLoanDocumentId);

    const loanAccount = await this.deps.loanAccountRepository.findById(session.loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', session.loanAccountId);
    const borrower = await this.deps.borrowerRepository.findById(loanAccount.borrowerId);

    const originalPdf = await this.deps.fileStorage.read(generatedDoc.storageKey);
    const signedAt = new Date();
    const stampedPdf = await this.deps.signatureStamper.stamp({
      pdfBuffer: originalPdf,
      signatureImagePng: input.signatureImagePng,
      signerName: borrower?.name.fullName() ?? 'Client',
      signedAtIso: signedAt.toISOString(),
      ipAddress: input.ipAddress,
    });

    const signedStorageKey = `loan-signing/${session.id}/${entry.id}-signed.pdf`;
    await this.deps.fileStorage.save(signedStorageKey, stampedPdf);

    session.markDocumentSigned(entry.id, signedStorageKey, input.ipAddress, input.userAgent, signedAt);
    await this.deps.loanSigningSessionRepository.save(session);
  }
}
