import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
import { SigningSessionExpiredError } from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import { hashSigningSecret } from '../../infrastructure/signingTokenHash';
import type { SigningLinkChannel } from '../../domain/LoanSigningSession';

export interface SigningSessionDocumentView {
  id: string;
  name: string;
  sortIndex: number;
  signed: boolean;
}

export interface SigningSessionView {
  loanCode: string;
  borrowerName: string;
  otpVerified: boolean;
  fullySigned: boolean;
  documents: SigningSessionDocumentView[];
  /** 2026-07-29 - lets the client-facing OTP screen say "Send code to my email"/"we emailed you"
   * instead of always assuming SMS, since the OTP now follows the link's own delivery channel. */
  channel: SigningLinkChannel;
}

export interface GetLoanSigningSessionUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  loanAccountRepository: ILoanAccountRepository;
  borrowerRepository: IBorrowerRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
}

/** Public (unauthenticated) read model for the client-facing signing page - never returns the
 * session's `id`/`tokenHash`, only what the page needs to render (loan/borrower labels, per-
 * document names + signed status). */
export class GetLoanSigningSessionUseCase {
  constructor(private readonly deps: GetLoanSigningSessionUseCaseDeps) {}

  async execute(rawToken: string): Promise<SigningSessionView> {
    const tokenHash = hashSigningSecret(rawToken);
    const session = await this.deps.loanSigningSessionRepository.findByTokenHash(tokenHash);
    if (!session || session.isExpiredOrRevoked()) throw new SigningSessionExpiredError();

    const loanAccount = await this.deps.loanAccountRepository.findById(session.loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', session.loanAccountId);
    const borrower = await this.deps.borrowerRepository.findById(loanAccount.borrowerId);

    const documents: SigningSessionDocumentView[] = [];
    for (const entry of [...session.documents].sort((a, b) => a.sortIndex - b.sortIndex)) {
      const generatedDoc = await this.deps.generatedLoanDocumentRepository.findById(entry.generatedLoanDocumentId);
      const template = generatedDoc ? await this.deps.documentTemplateRepository.findById(generatedDoc.documentTemplateId) : null;
      documents.push({
        id: entry.id,
        name: template?.name ?? 'Document',
        sortIndex: entry.sortIndex,
        signed: Boolean(entry.signedAt),
      });
    }

    return {
      loanCode: loanAccount.loanCode,
      borrowerName: borrower?.name.fullName() ?? '',
      otpVerified: session.isOtpVerifiedFresh(),
      fullySigned: session.isFullySigned(),
      documents,
      channel: session.channel,
    };
  }
}
