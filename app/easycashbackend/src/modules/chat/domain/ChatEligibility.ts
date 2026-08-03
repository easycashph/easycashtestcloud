/**
 * Portal<->LMS support chat (2026-07-31 user request) - who can claim a new chat request, and who
 * a claimed chat can be transferred up to. Business-confirmed mapping onto this company's real,
 * seeded roles/role classes (verified directly against the `roles`/`role_classes` tables - "Loan
 * Officer" and "Manager" are NOT real role names here):
 *
 *  - Claim-eligible ("loan officers" in the user's own words): every member of the Collection
 *    Officer role (its role classes today: Collection Manager, Field Collection Officer, Loan
 *    Account Recovery Officer - more may be added later, so this checks the ROLE, not the role
 *    class), plus every Loan Operation Manager.
 *  - Manager-eligible (where a claimed chat can be transferred): Loan Operation Manager, or a
 *    Collection Officer whose role class is specifically "Collection Manager".
 */
export interface ChatEligibilityUser {
  roles: string[];
  roleClassName: string | null;
}

const COLLECTION_OFFICER_ROLE = 'Collection Officer';
const LOAN_OPERATION_MANAGER_ROLE = 'Loan Operation Manager';
const COLLECTION_MANAGER_ROLE_CLASS = 'Collection Manager';

export function canClaimNewConversations(user: ChatEligibilityUser): boolean {
  return user.roles.includes(COLLECTION_OFFICER_ROLE) || user.roles.includes(LOAN_OPERATION_MANAGER_ROLE);
}

export function canClaimManagerConversations(user: ChatEligibilityUser): boolean {
  if (user.roles.includes(LOAN_OPERATION_MANAGER_ROLE)) return true;
  return user.roles.includes(COLLECTION_OFFICER_ROLE) && user.roleClassName === COLLECTION_MANAGER_ROLE_CLASS;
}
