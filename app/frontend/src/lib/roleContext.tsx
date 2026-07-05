import * as React from 'react';
import { MOCK_LMS_MEMBERS, type LmsRole, type MockLmsMember } from './mockData';

/** All staff accounts are selectable from the "Switch Account" panel — real confirmed roster. */
export const SWITCHABLE_ACCOUNTS: MockLmsMember[] = MOCK_LMS_MEMBERS;

interface RoleContextValue {
  currentAccount: MockLmsMember;
  role: LmsRole;
  switchAccount: (memberId: string) => void;
  /** Only "MIS" (super user) may add/edit LMS member accounts. */
  canManageMembers: boolean;
  /** MIS, Loan Operation Manager, and CRM may view/assign/approve/decline Loan Applications. Finance, Accounting, and Collection Officer cannot. */
  canAccessLoanApplications: boolean;
  /** Only MIS may revert a decided (Approved/Declined) Loan Application back to Pending Review — the accidental-click safety net. */
  canRevertLoanApplicationDecision: boolean;
  /** Only MIS sees Activity Logs — both the dedicated section and every per-section "Recent Activity" panel. */
  canViewActivityLogs: boolean;
  /** MIS, Loan Operation Manager, and CRM may create a Loan Account from a Client profile. */
  canCreateLoanAccount: boolean;
}

const RoleContext = React.createContext<RoleContextValue | undefined>(undefined);

/**
 * Mock account switcher (NOT real authentication/authorization — no
 * username/password check happens anywhere). Lets the CEO see, live, how
 * access changes when "switched" to a different staff account, per the
 * confirmed access policy:
 *   - MIS: super user, all access, including reverting a decided Loan
 *     Application back to Pending Review.
 *   - Loan Operation Manager, CRM: same base access as Finance/Accounting/
 *     Collection Officer, PLUS the special right to access Loan
 *     Applications (assign product sub-type, approve, decline) — but
 *     neither can revert a decision once made.
 *   - Finance / Accounting / Collection Officer: share one base access tier
 *     — cannot manage LMS members, cannot access Loan Applications.
 *   - Only MIS ever sees Activity Logs (the dedicated section and every
 *     per-section "Recent Activity" panel) — not even Loan Operation
 *     Manager or CRM.
 * Held in memory only; defaults to the first MIS account so the full
 * feature set is visible on first load.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentAccount, setCurrentAccount] = React.useState<MockLmsMember>(SWITCHABLE_ACCOUNTS[0]);
  const value = React.useMemo<RoleContextValue>(
    () => ({
      currentAccount,
      role: currentAccount.role,
      switchAccount: (memberId: string) => {
        const next = SWITCHABLE_ACCOUNTS.find((m) => m.id === memberId);
        if (next) setCurrentAccount(next);
      },
      canManageMembers: currentAccount.role === 'MIS',
      canAccessLoanApplications:
        currentAccount.role === 'MIS' || currentAccount.role === 'Loan Operation Manager' || currentAccount.role === 'CRM',
      canRevertLoanApplicationDecision: currentAccount.role === 'MIS',
      canViewActivityLogs: currentAccount.role === 'MIS',
      canCreateLoanAccount:
        currentAccount.role === 'MIS' || currentAccount.role === 'Loan Operation Manager' || currentAccount.role === 'CRM',
    }),
    [currentAccount],
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}
