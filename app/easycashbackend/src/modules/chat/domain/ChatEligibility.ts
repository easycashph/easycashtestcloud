/**
 * Portal<->LMS support chat (2026-07-31 user request) - who can claim a brand-new chat request
 * from the Waiting queue. Business-confirmed mapping onto this company's real, seeded roles/role
 * classes (verified directly against the `roles`/`role_classes` tables - "Loan Officer" is NOT a
 * real role name here):
 *
 *  - Claim-eligible ("loan officers" in the user's own words): every member of the Collection
 *    Officer role (its role classes today: Collection Manager, Field Collection Officer, Loan
 *    Account Recovery Officer - more may be added later, so this checks the ROLE, not the role
 *    class), plus every Loan Operation Manager.
 *
 * 2026-07-31 (transfer redesign, user request): a CLAIMED conversation's transfer target is no
 * longer role-restricted - the current claimant can hand off to ANY LMS user they pick (Role ->
 * Role Class -> person), confirmed by a shared PIN. There is no more "manager-eligible" queue
 * concept to check against.
 */
export interface ChatEligibilityUser {
  roles: string[];
  roleClassName: string | null;
}

const COLLECTION_OFFICER_ROLE = 'Collection Officer';
const LOAN_OPERATION_MANAGER_ROLE = 'Loan Operation Manager';

export function canClaimNewConversations(user: ChatEligibilityUser): boolean {
  return user.roles.includes(COLLECTION_OFFICER_ROLE) || user.roles.includes(LOAN_OPERATION_MANAGER_ROLE);
}
