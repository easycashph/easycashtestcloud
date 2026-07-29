import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
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
  coBorrowerRepository: ICoBorrowerRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
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

    const template = await this.deps.documentTemplateRepository.findById(generatedDoc.documentTemplateId);

    let signerName = 'Client';
    if (session.partyType === 'CO_BORROWER') {
      const coBorrower = session.coBorrowerId ? await this.deps.coBorrowerRepository.findById(session.coBorrowerId) : null;
      signerName = coBorrower?.name.fullName() ?? signerName;
    } else {
      const borrower = await this.deps.borrowerRepository.findById(loanAccount.borrowerId);
      signerName = borrower?.name.fullName() ?? signerName;
    }

    // 2026-07-25 (two-party signing): for a document that requires BOTH signatures, stamp onto
    // whichever party already signed it (any OTHER session on this same loan account, for this
    // same generatedLoanDocumentId) rather than the pristine original - so the borrower's and
    // co-borrower's ink end up on the SAME final PDF instead of two independent single-signature
    // copies. Falls back to the pristine original if this is the first (or only) signature.
    //
    // 2026-07-29 (real bug found): the "other session" lookup only excluded THIS session
    // (`s.id !== session.id`), not sessions belonging to the SAME party - so re-signing the same
    // document as the same party through a second session (e.g. a fresh test/retry) picked up that
    // party's own already-stamped PDF as the base and stamped a second signature/audit block on top
    // of the first, both landing at the identical anchor position (visible as doubled, overlapping
    // text and signature ink). Only the OPPOSITE party's signed copy should ever be used as the base.
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
      // 2026-07-29 (user request) - which channel/recipient the OTP for THIS signature went to,
      // same value SigningNotificationLog records for the OTP send itself (session.channel/email/
      // phoneNumber are captured once at send time, never re-read from the profile later).
      otpChannel: session.channel,
      otpRecipient: session.channel === 'EMAIL' && session.email ? session.email : session.phoneNumber,
    });

    const signedStorageKey = `loan-signing/${session.id}/${entry.id}-signed.pdf`;
    await this.deps.fileStorage.save(signedStorageKey, stampedPdf);

    session.markDocumentSigned(entry.id, signedStorageKey, input.ipAddress, input.userAgent, signedAt);
    await this.deps.loanSigningSessionRepository.save(session);
  }
}
