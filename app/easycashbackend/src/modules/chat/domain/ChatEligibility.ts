/**
 * Portal<->LMS support chat (2026-07-31 user request, revised 2026-08-03) - who can claim a
 * brand-new chat request from the Waiting queue. Business-confirmed mapping onto this company's
 * real, seeded role names (verified directly against the `roles` table):
 *
 *  - Collection Officer ("Collection")
 *  - CRM ("Customer Relation Management")
 *  - MIS ("Management Information System")
 *
 * 2026-08-03 (user correction): Loan Operation Manager is no longer claim-eligible for INITIAL
 * chat support - only the three roles above. A claimed conversation's transfer target is still
 * unrestricted (any LMS user, via the Role -> Role Class -> person PIN handoff - see
 * InitiateChatTransferUseCase).
 */
export interface ChatEligibilityUser {
  roles: string[];
  roleClassName: string | null;
}

const COLLECTION_OFFICER_ROLE = 'Collection Officer';
const CRM_ROLE = 'CRM';
const MIS_ROLE = 'MIS';

export function canClaimNewConversations(user: ChatEligibilityUser): boolean {
  return user.roles.includes(COLLECTION_OFFICER_ROLE) || user.roles.includes(CRM_ROLE) || user.roles.includes(MIS_ROLE);
}
