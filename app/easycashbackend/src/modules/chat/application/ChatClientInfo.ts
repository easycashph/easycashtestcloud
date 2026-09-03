import type { IPortalAccountRepository } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';

export interface ChatClientLoanApplicationSummary {
  id: string;
  applicantName: string;
  requestedCategory: string;
  status: string;
}

export interface ChatClientInfo {
  portalAccountEmail: string | null;
  /**
   * 2026-09-03 (user request: "pwede ba natin i display ang pangalan ng borrower? hindi lang
   * email") - null only when none of the three sources below have a name at all (e.g. a
   * brand-new self-signup that hasn't filled the pre-application profile or applied for
   * anything yet). Resolved in priority order, most authoritative first:
   *   1. The linked Borrower's own name, if this account is bound to one (`borrowerId`) - the
   *      real, staff-verified client record.
   *   2. The PortalAccount's own pre-application profile name (`firstName`/`lastName`/etc,
   *      2026-07-30), for an account not yet bound to a Borrower.
   *   3. The most recent loan application's `applicantName`, if they've applied but the two
   *      sources above still came up empty.
   */
  portalAccountName: string | null;
  /** Every loan application this portal account has submitted, most recent first - so a loan
   * officer chatting with them can click straight through to review it (2026-08-03 user
   * request: "naka-link din ang kanyang loan application form... clickable din ito para ma
   * review"). Empty if they haven't applied yet. */
  loanApplications: ChatClientLoanApplicationSummary[];
}

/** Shared by GetChatConversationForStaffUseCase and GetChatConversationForMisUseCase - "who is
 * this portal user, and do they have an application on file" is the same lookup either way. */
export async function buildChatClientInfo(
  deps: {
    portalAccountRepository: IPortalAccountRepository;
    loanApplicationRepository: ILoanApplicationRepository;
    borrowerRepository: IBorrowerRepository;
  },
  portalAccountId: string,
): Promise<ChatClientInfo> {
  const [account, applications] = await Promise.all([
    deps.portalAccountRepository.findById(portalAccountId),
    deps.loanApplicationRepository.findByPortalAccountId(portalAccountId),
  ]);
  const borrower = account?.borrowerId ? await deps.borrowerRepository.findById(account.borrowerId) : null;

  const sortedApplications = applications
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
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const profileName = account
    ? [account.firstName, account.middleName, account.lastName, account.suffix].filter(Boolean).join(' ').trim()
    : '';

  const portalAccountName =
    borrower?.name.fullName() || profileName || sortedApplications[0]?.applicantName || null;

  return {
    portalAccountEmail: account?.email ?? null,
    portalAccountName,
    loanApplications: sortedApplications.map(({ createdAt: _createdAt, ...rest }) => rest),
  };
}
