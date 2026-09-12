import type { LoanApplicationStatus } from './loanApplicationApiTypes';

/**
 * 2026-07-17 (Under Review / Pre Approval stages) — single source of truth for how each
 * LoanApplicationStatus is displayed, shared by LoanApplicationsPage (filter dropdown + table
 * badge) and LoanApplicationDetailPage (heading badge), so a future relabel only needs one edit.
 * PREAPPROVED/PREDECLINED are relabeled here to match the company's actual terminology
 * ("Requirement Compliance" / "Pre Declined") without touching the underlying enum values.
 */
export const STATUS_DISPLAY_LABEL: Record<LoanApplicationStatus, string> = {
  INCOMPLETE: 'Incomplete',
  PREAPPROVED: 'Requirement Compliance',
  PREDECLINED: 'Pre Declined',
  UNDER_REVIEW: 'Under Review',
  PRE_APPROVAL: 'Pre Approval',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
};
