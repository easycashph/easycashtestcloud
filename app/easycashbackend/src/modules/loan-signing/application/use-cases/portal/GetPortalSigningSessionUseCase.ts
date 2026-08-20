import { NotFoundError } from '@shared/errors/DomainError';
import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
import type { ILoanSigningSessionRepository } from '../../ports/ILoanSigningSessionRepository';
import type { SigningSessionView } from '../GetLoanSigningSessionUseCase';
import { resolvePortalSigningSession } from './resolvePortalSigningSession';

/**
 * 2026-08-20 (Portal e-signature, user request): Portal-authenticated counterpart of
 * `GetLoanSigningSessionUseCase` - same `SigningSessionView` shape (so the Portal-side signing
 * page can reuse the exact same rendering logic as the public one), but resolved by
 * `sessionId + portalAccountId` ownership instead of a raw link token.
 */
export class GetPortalSigningSessionUseCase {
  constructor(
    private readonly deps: {
      loanSigningSessionRepository: ILoanSigningSessionRepository;
      portalAccountRepository: IPortalAccountRepository;
      loanAccountRepository: ILoanAccountRepository;
      borrowerRepository: IBorrowerRepository;
      generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
      documentTemplateRepository: IDocumentTemplateRepository;
    },
  ) {}

  async execute(sessionId: string, portalAccountId: string): Promise<SigningSessionView> {
    const session = await resolvePortalSigningSession(sessionId, portalAccountId, this.deps);

    const loanAccount = await this.deps.loanAccountRepository.findById(session.loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', session.loanAccountId);
    const borrower = await this.deps.borrowerRepository.findById(loanAccount.borrowerId);

    const documents = [];
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
