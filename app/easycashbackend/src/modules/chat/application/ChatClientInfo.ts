import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';

export interface ChatClientLoanApplicationSummary {
  id: string;
  applicantName: string;
  requestedCategory: string;
  status: string;
}

export interface ChatClientInfo {
  portalAccountEmail: string | null;
  /** Every loan application this portal account has submitted, most recent first - so a loan
   * officer chatting with them can click straight through to review it (2026-08-03 user
   * request: "naka-link din ang kanyang loan application form... clickable din ito para ma
   * review"). Empty if they haven't applied yet. */
  loanApplications: ChatClientLoanApplicationSummary[];
}

/** Shared by GetChatConversationForStaffUseCase and GetChatConversationForMisUseCase - "who is
 * this portal user, and do they have an application on file" is the same lookup either way. */
export async function buildChatClientInfo(
  deps: { portalAccountRepository: IPortalAccountRepository; loanApplicationRepository: ILoanApplicationRepository },
  portalAccountId: string,
): Promise<ChatClientInfo> {
  const [account, applications] = await Promise.all([
    deps.portalAccountRepository.findById(portalAccountId),
    deps.loanApplicationRepository.findByPortalAccountId(portalAccountId),
  ]);

  return {
    portalAccountEmail: account?.email ?? null,
    loanApplications: applications
      .map((application) => {
        const props = application.toProps();
        return {
          id: props.id,
          applicantName: props.applicantName,
          requestedCategory: props.requestedCategory,
          status: props.status,
          createdAt: props.createdAt,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ createdAt: _createdAt, ...rest }) => rest),
  };
}
