import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanSigningSessionRepository } from '../../ports/ILoanSigningSessionRepository';

export interface PortalPendingSigningSessionView {
  sessionId: string;
  loanAccountId: string;
  loanCode: string;
  documentCount: number;
  documentsSignedCount: number;
}

/**
 * 2026-08-20 (Portal e-signature, user request): backs the "Sign Documents" prompt on the Portal
 * dashboard - every loan account belonging to this borrower with at least one active (not
 * expired/revoked, not yet fully signed), `BORROWER`-party signing session. A loan can have more
 * than one open session across time (e.g. a resend); this returns each session that still has
 * unsigned documents, letting the Portal point the client at whichever is actually current.
 */
export class ListPortalSigningSessionsUseCase {
  constructor(
    private readonly deps: {
      loanSigningSessionRepository: ILoanSigningSessionRepository;
      portalAccountRepository: IPortalAccountRepository;
      loanAccountRepository: ILoanAccountRepository;
    },
  ) {}

  async execute(portalAccountId: string): Promise<PortalPendingSigningSessionView[]> {
    const portalAccount = await this.deps.portalAccountRepository.findById(portalAccountId);
    if (!portalAccount?.borrowerId) return [];

    const loanAccounts = await this.deps.loanAccountRepository.findMany({ borrowerId: portalAccount.borrowerId, limit: 50 });

    const views: PortalPendingSigningSessionView[] = [];
    for (const loanAccount of loanAccounts) {
      const sessions = await this.deps.loanSigningSessionRepository.findManyByLoanAccountId(loanAccount.id);
      for (const session of sessions) {
        if (session.partyType !== 'BORROWER' || session.isExpiredOrRevoked() || session.isFullySigned()) continue;
        views.push({
          sessionId: session.id,
          loanAccountId: loanAccount.id,
          loanCode: loanAccount.loanCode,
          documentCount: session.documents.length,
          documentsSignedCount: session.documents.filter((d) => d.signedAt).length,
        });
      }
    }
    return views;
  }
}
