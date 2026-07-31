/**
 * Shared between RecentSystemActivityPanel (dashboard-wide, all roles) and RecentActivityPanel
 * (per-section, MIS-only) so every "recent activity" surface in the app renders the same readable
 * sentence for a given action instead of each widget maintaining its own copy that drifts.
 * 2026-07-30 (user request): extracted out of RecentSystemActivityPanel, which is where this
 * originally lived alone.
 */

/** action -> verb phrase applied to "{userName} {verb} {entity link, if any}". No trailing punctuation. */
export const ACTION_VERB: Record<string, string> = {
  ACTIVATE_LOAN: 'disbursed loan',
  ADJUST_FEES: 'adjusted fees on',
  APPROVE_LOAN: 'approved loan',
  APPROVE_LOAN_APPLICATION: 'approved application',
  CHANGE_OWN_PASSWORD: 'changed their password',
  CREATE_CO_BORROWER: 'added a co-borrower to',
  CREATE_MEMBER: 'created a new user account',
  CREATE_ROLE_CLASS: 'created a role class',
  DECLINE_LOAN_APPLICATION: 'declined application',
  DELETE_LOAN_NOTE: 'deleted a note on',
  LOGIN_FAILED: 'failed to log in',
  LOGIN_SUCCESS: 'logged in',
  PROCESS_PAYMENT: 'recorded a payment on',
  REDUCE_PENALTY: 'reduced a penalty on',
  REJECT_LOAN: 'rejected loan',
  REVERSE_PAYMENT: 'reversed a payment on',
  REVERT_LOAN_APPLICATION_DECISION: 'reverted the decision on',
  START_LOAN_APPLICATION_REVIEW: 'started reviewing',
  TAG_LOAN_APPLICATION_PRE_APPROVAL: 'tagged pre-approval on',
  UNDO_ACTIVATE_LOAN: 'undid the disbursement of',
  UNDO_APPROVE_LOAN: 'undid the approval of',
  UPDATE_LOAN_APPLICATION_REVIEW_REPORT: 'updated the review report on',
  UPDATE_ROLE_CLASS: 'updated a role class',
};

/** entityType -> route prefix for records worth linking to. Everything else renders as plain text. */
export const ENTITY_ROUTE: Record<string, string> = {
  LoanAccount: '/loans',
  LoanApplication: '/applications',
};
