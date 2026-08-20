import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
import { ConsentRequiredError, OtpVerificationRequiredError } from '../../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../../ports/ILoanSigningSessionRepository';
import type { IDocumentSignatureStamper } from '../../ports/IDocumentSignatureStamper';
import { resolvePortalSigningSession } from './resolvePortalSigningSession';

export interface SignPortalLoanSigningDocumentInput {
  sessionId: string;
  portalAccountId: string;
  signingDocumentId: string;
  consentChecked: boolean;
  signatureImagePng: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 2026-08-20 (Portal e-signature, user request): Portal-authenticated counterpart of
 * `SignLoanSigningDocumentUseCase` - same stamping/audit-trail behavior (new PDF, original never
 * touched; two-party documents stamp onto the other party's already-signed copy when one exists),
 * resolved by `sessionId + portalAccountId` instead of a raw link token. `partyType` is always
 * `BORROWER` here (enforced by `resolvePortalSigningSession`), so the co-borrower name-lookup
 * branch the public use-case has is not needed.
 */
export class SignPortalLoanSigningDocumentUseCase {
  constructor(
    private readonly deps: {
      loanSigningSessionRepository: ILoanSigningSessionRepository;
      portalAccountRepository: IPortalAccountRepository;
      loanAccountRepository: ILoanAccountRepository;
      borrowerRepository: IBorrowerRepository;
      generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
      documentTemplateRepository: IDocumentTemplateRepository;
      fileStorage: IFileStorage;
      signatureStamper: IDocumentSignatureStamper;
    },
  ) {}

  async execute(input: SignPortalLoanSigningDocumentInput): Promise<void> {
    if (!input.consentChecked) throw new ConsentRequiredError();

    const session = await resolvePortalSigningSession(input.sessionId, input.portalAccountId, this.deps);
    if (!session.isOtpVerifiedFresh()) throw new OtpVerificationRequiredError();

    const entry = session.findDocument(input.signingDocumentId);
    if (!entry) throw new NotFoundError('LoanSigningDocument', input.signingDocumentId);

    const generatedDoc = await this.deps.generatedLoanDocumentRepository.findById(entry.generatedLoanDocumentId);
    if (!generatedDoc) throw new NotFoundError('GeneratedLoanDocument', entry.generatedLoanDocumentId);

    const loanAccount = await this.deps.loanAccountRepository.findById(session.loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', session.loanAccountId);

    const template = await this.deps.documentTemplateRepository.findById(generatedDoc.documentTemplateId);
    const borrower = await this.deps.borrowerRepository.findById(loanAccount.borrowerId);
    const signerName = borrower?.name.fullName() ?? 'Client';

    // Same two-party base-PDF selection as SignLoanSigningDocumentUseCase - see that use-case's
    // own doc comment for the full reasoning (stamp onto the co-borrower's already-signed copy of
    // this same document if one exists, so both signatures land on one final PDF).
    const otherSessions = await this.deps.loanSigningSessionRepository.findManyByLoanAccountId(session.loanAccountId);
    const priorSignedEntry = otherSessions
      .filter((s) => s.id !== session.id && s.partyType !== session.partyType)
      .flatMap((s) => s.documents)
      .filter((d) => d.generatedLoanDocumentId === entry.generatedLoanDocumentId && d.signedAt && d.signedStorageKey)
      .sort((a, b) => (b.signedAt?.getTime() ?? 0) - (a.signedAt?.getTime() ?? 0))[0];

    const basePdf = await this.deps.fileStorage.read(priorSignedEntry?.signedStorageKey ?? generatedDoc.storageKey);
    const signedAt = new Date();
    const stampedPdf = await this.deps.signatureStamper.stamp({
      pdfBuffer: basePdf,
      signatureImagePng: input.signatureImagePng,
      signerName,
      signedAtIso: signedAt.toISOString(),
      ipAddress: input.ipAddress,
      templateCode: template?.code,
      anchorTarget: session.partyType,
      otpChannel: session.email ? 'EMAIL' : 'SMS',
      otpRecipient: session.email ? session.email : session.phoneNumber,
    });

    const signedStorageKey = `loan-signing/${session.id}/${entry.id}-signed.pdf`;
    await this.deps.fileStorage.save(signedStorageKey, stampedPdf);

    session.markDocumentSigned(entry.id, signedStorageKey, input.ipAddress, input.userAgent, signedAt);
    await this.deps.loanSigningSessionRepository.save(session);
  }
}
