import * as React from 'react';
import { apiClient, ApiError, applyAuthTokens, clearAuthTokens, setOnSessionExpired, getStoredDeviceToken, setStoredDeviceToken } from './apiClient';
import type { AuthenticatedUserView, LoginResponse, LoginSuccessResponse, RefreshResponse } from './authTypes';
import { useTheme } from '@/components/theme-provider';
import { useDashboardLayout } from '@/components/dashboard-layout-provider';
import type { LmsRole } from './staticConfig';
import { LoginPage } from '@/pages/LoginPage';

/** Authenticated account shape every existing page already consumes (`currentAccount.id/name/role`) - unchanged from the mock era, now sourced from the real backend. */
export interface AuthenticatedAccount {
  id: string;
  name: string;
  role: LmsRole;
  /** Full role list - a real user can hold more than one; every existing permission check uses `role` (the first/primary one), matching this app's one-role-per-session UX so far. */
  roles: LmsRole[];
  email: string;
  branchId: string;
}

/**
 * 2026-08-06 (Roles & Permissions feature): the exact `Permission.code` strings seeded in
 * `prisma/seed.ts` - kept as a union here so every `hasPermission(...)` call site is checked
 * against a real, known code (a typo fails to compile instead of silently always returning
 * false). Every `can*` boolean below is now DERIVED from this, not from a hard-coded role-name
 * check - before this, `canCreateLoanAccount` etc. were a second, frontend-only copy of the
 * backend's old `requireRole` allow-lists, completely blind to whatever MIS configures on the new
 * Roles & Permissions screen. Add a new code here whenever the backend seed gains one.
 */
export type PermissionCode =
  | 'loan_application.manage'
  | 'loan_application.final_approve'
  | 'loan_application.revert'
  | 'loan_account.originate'
  | 'loan_account.approve'
  | 'loan_account.undo_approve'
  | 'loan_account.activate'
  | 'loan_account.undo_activate'
  | 'loan_account.restructure'
  | 'loan_account.adjust'
  | 'payment.record'
  | 'payment.reverse'
  | 'penalty.reduce'
  | 'fees.adjust'
  | 'document.generate'
  | 'statement_of_account.generate'
  | 'attachment.upload'
  | 'esignature.manage'
  | 'borrower.write'
  | 'loan_product.write'
  | 'ai_extraction.use'
  | 'collection.view_past_due'
  | 'collection.note.write'
  | 'report.view'
  | 'user.manage'
  | 'audit_log.read'
  | 'reminder_settings.manage'
  | 'profile_activity_log.manage';

interface RoleContextValue {
  currentAccount: AuthenticatedAccount;
  role: LmsRole;
  /** Signs out and returns to the Login page. Replaces the old mock account switcher - with real auth, "switching" means logging in as someone else. */
  logout: () => Promise<void>;
  /** Only "MIS" (super user) may add/edit LMS member accounts. */
  canManageMembers: boolean;
  /** MIS, Loan Operation Manager, and CRM may view/assign/approve/decline Loan Applications. Finance, Accounting, and Collection Officer cannot. */
  canAccessLoanApplications: boolean;
  /** Only MIS may revert a decided (Approved/Declined) Loan Application back to Pending Review - the accidental-click safety net. */
  canRevertLoanApplicationDecision: boolean;
  /** Only MIS sees Activity Logs - both the dedicated section and every per-section "Recent Activity" panel. */
  canViewActivityLogs: boolean;
  /** MIS, Loan Operation Manager, and CRM may create a Loan Account from a Client profile. */
  canCreateLoanAccount: boolean;
  /** Only MIS and Loan Operation Manager may Approve a Loan Account - excludes CRM (2026-07-21
   * user correction): CRM's role stops at Tag Pre Approval on the application; the Manager gives
   * the separate, later approval on the created account, a distinct separation-of-duties check. */
  canApproveLoanAccount: boolean;
  /** MIS, Loan Operation Manager, and Accounting may Activate/Disburse a Loan Account (2026-07-21
   * user correction) - excludes CRM, which has no role past Tag Pre Approval/Approve. */
  canActivateLoanAccount: boolean;
  /** MIS, Loan Operation Manager, and CRM may Start Review, save the Review Report, and Tag Pre
   * Approval (2026-07-17, Under Review / Pre Approval stages) - the same role set as
   * canAccessLoanApplications today, kept as its own named boolean so a future change to one
   * doesn't silently affect the other. */
  canReviewLoanApplication: boolean;
  /** Only MIS and Loan Operation Manager may give the FINAL Approve on a Loan Application -
   * excludes CRM, whose role in the pipeline stops at Tag Pre Approval (2026-07-17). */
  canApproveLoanApplication: boolean;
  /** MIS-only (2026-07-18 user request) - the Settings page's SMS/Email reminder master switches. */
  canManageReminderSettings: boolean;
  /** Generate a loan document (e.g. Loan Agreement, Disclosure Statement) - previously unrestricted
   * beyond authentication (ADR-051 §5), configurable per role since 2026-08-06. */
  canGenerateDocuments: boolean;
  /** Generate a Statement of Account - previously unrestricted beyond authentication (ADR-052,
   * mirrors ADR-051 §5), same gap `canGenerateDocuments` had, configurable per role since
   * 2026-08-06. */
  canGenerateStatementOfAccount: boolean;
  /** Send/manage an e-signature session - previously unrestricted beyond authentication, same
   * class of action as `canGenerateDocuments`, configurable per role since 2026-08-06. */
  canManageESignature: boolean;
  /** Record a borrower payment. */
  canRecordPayment: boolean;
  /** Reverse a recorded payment - MIS-only by default, an accidental-click safety net. */
  canReversePayment: boolean;
  /** Reduce/waive an installment penalty. */
  canReducePenalty: boolean;
  /** Adjust an installment fee amount. */
  canAdjustFees: boolean;
  /** Restructure a loan account. */
  canRestructureLoan: boolean;
  /** Write off/adjust a loan account. */
  canAdjustLoan: boolean;
  /** Create or edit a Client (Borrower) profile. */
  canManageClients: boolean;
  /** True if the signed-in user's role currently has the given permission code granted - the
   * general-purpose escape hatch for a check that doesn't already have its own named `can*`
   * boolean above. */
  hasPermission: (code: PermissionCode) => boolean;
  /** Re-fetches `GET /auth/me` and updates `currentAccount` - call after a self-service profile
   * update so the sidebar/header name updates without requiring a full reload. */
  refreshCurrentUser: () => Promise<void>;
}

const RoleContext = React.createContext<RoleContextValue | undefined>(undefined);

const KNOWN_ROLES: LmsRole[] = ['MIS', 'Loan Operation Manager', 'CRM', 'Finance', 'Accounting', 'Collection Officer'];

function toAccount(user: AuthenticatedUserView): AuthenticatedAccount {
  const roles = user.roles.filter((r): r is LmsRole => (KNOWN_ROLES as string[]).includes(r));
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: roles[0] ?? 'Collection Officer',
    roles: roles.length > 0 ? roles : ['Collection Officer'],
    email: user.email,
    branchId: user.branchId,
  };
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Frontend↔Backend Wiring Pilot, Stage 0b
 * (`docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md`). Replaces the mock,
 * pick-any-account "Switch Account" panel with a real session backed by `POST /auth/login` and
 * `GET /auth/me`. Gates its `children` behind authentication: renders the Login page instead of
 * `children` until a real session exists, so every already-existing page under `AppLayout` can go
 * on assuming `currentAccount` is always defined, exactly as before this pilot.
 *
 * On mount, attempts a silent `POST /auth/refresh` (reads the HttpOnly refresh-token cookie from a
 * prior session, if any) before falling back to the Login page - an access token is never persisted
 * client-side (see `apiClient.ts`), so every hard page reload re-derives one this way.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [user, setUser] = React.useState<AuthenticatedUserView | null>(null);
  const { loadPreferenceFor } = useTheme();
  const { loadPreferenceFor: loadDashboardLayoutFor } = useDashboardLayout();
  // A manual login() can resolve before the mount-time silent refresh below does (e.g. the
  // refresh is slow, rate-limited, or the browser session predates a stale refresh token). Without
  // this guard, the refresh's catch block would still fire afterwards and stomp the just-set
  // 'authenticated' status back to 'unauthenticated', silently kicking the user back to the login
  // screen despite a successful login.
  const loggedInRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refreshed = await apiClient.post<RefreshResponse>('/auth/refresh');
        applyAuthTokens(refreshed.accessToken, refreshed.accessTokenExpiresAt);
        const me = await apiClient.get<AuthenticatedUserView>('/auth/me');
        if (cancelled || loggedInRef.current) return;
        setUser(me);
        loadPreferenceFor(me.id);
        loadDashboardLayoutFor(me.id);
        setStatus('authenticated');
      } catch {
        if (cancelled || loggedInRef.current) return;
        clearAuthTokens();
        loadPreferenceFor(null);
        loadDashboardLayoutFor(null);
        setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Bootstrap runs once on mount only - loadPreferenceFor is a stable useCallback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySuccessfulLogin = React.useCallback(
    (result: LoginSuccessResponse) => {
      if (result.deviceToken) setStoredDeviceToken(result.deviceToken);
      loggedInRef.current = true;
      applyAuthTokens(result.accessToken, result.accessTokenExpiresAt);
      setUser(result.user);
      loadPreferenceFor(result.user.id);
      loadDashboardLayoutFor(result.user.id);
      setStatus('authenticated');
    },
    [loadPreferenceFor, loadDashboardLayoutFor],
  );

  const login = React.useCallback(
    async (email: string, password: string): Promise<LoginResponse> => {
      // "Remember this device" (2026-07-30 user request) - a stored trusted-device token lets
      // LoginUseCase skip the 2FA challenge entirely for a 2FA-enabled account.
      const result = await apiClient.post<LoginResponse>('/auth/login', { email, password, deviceToken: getStoredDeviceToken() ?? undefined });
      // 2026-07-22 (Two-Factor Authentication) - LoginPage handles the `twoFactorRequired` branch
      // itself (shows the OTP entry step); only a genuine success is applied to session state here.
      if (!('twoFactorRequired' in result)) {
        applySuccessfulLogin(result);
      }
      return result;
    },
    [applySuccessfulLogin],
  );

  const verifyLoginOtp = React.useCallback(
    async (challengeId: string, code: string, rememberDevice: boolean) => {
      const result = await apiClient.post<LoginSuccessResponse>('/auth/verify-login-otp', { challengeId, code, rememberDevice });
      applySuccessfulLogin(result);
    },
    [applySuccessfulLogin],
  );

  const refreshCurrentUser = React.useCallback(async () => {
    const me = await apiClient.get<AuthenticatedUserView>('/auth/me');
    setUser(me);
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Best-effort - even if the network call fails, clear local session state below so the
      // user isn't stuck "logged in" against a UI that can no longer reach the backend.
    }
    clearAuthTokens();
    setUser(null);
    loadPreferenceFor(null);
    loadDashboardLayoutFor(null);
    setStatus('unauthenticated');
  }, [loadPreferenceFor, loadDashboardLayoutFor]);

  // Without this, a session that goes bad mid-use (refresh token expired, or revoked via the
  // backend's rotation-reuse detection) left every page silently 401-ing forever with no way to
  // recover except a manual hard reload - `apiClient.ts`'s `onSessionExpired` hook fires exactly
  // once per failed background refresh, and this bounces the user back to the Login page instead.
  React.useEffect(() => {
    setOnSessionExpired(() => {
      clearAuthTokens();
      setUser(null);
      loadPreferenceFor(null);
      loadDashboardLayoutFor(null);
      setStatus('unauthenticated');
    });
    return () => setOnSessionExpired(null);
  }, [loadPreferenceFor, loadDashboardLayoutFor]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <LoginPage onLogin={login} onVerifyOtp={verifyLoginOtp} />;
  }

  const currentAccount = toAccount(user);
  const grantedCodes = new Set(user.permissionCodes);
  const hasPermission = (code: PermissionCode) => grantedCodes.has(code);
  const value: RoleContextValue = {
    currentAccount,
    role: currentAccount.role,
    logout,
    canManageMembers: hasPermission('user.manage'),
    canAccessLoanApplications: hasPermission('loan_application.manage'),
    canRevertLoanApplicationDecision: hasPermission('loan_application.revert'),
    canViewActivityLogs: hasPermission('audit_log.read'),
    canCreateLoanAccount: hasPermission('loan_account.originate'),
    canApproveLoanAccount: hasPermission('loan_account.approve'),
    canActivateLoanAccount: hasPermission('loan_account.activate'),
    canReviewLoanApplication: hasPermission('loan_application.manage'),
    canApproveLoanApplication: hasPermission('loan_application.final_approve'),
    canManageReminderSettings: hasPermission('reminder_settings.manage'),
    canGenerateDocuments: hasPermission('document.generate'),
    canGenerateStatementOfAccount: hasPermission('statement_of_account.generate'),
    canManageESignature: hasPermission('esignature.manage'),
    canRecordPayment: hasPermission('payment.record'),
    canReversePayment: hasPermission('payment.reverse'),
    canReducePenalty: hasPermission('penalty.reduce'),
    canAdjustFees: hasPermission('fees.adjust'),
    canRestructureLoan: hasPermission('loan_account.restructure'),
    canAdjustLoan: hasPermission('loan_account.adjust'),
    canManageClients: hasPermission('borrower.write'),
    hasPermission,
    refreshCurrentUser,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}

/** Re-exported so call sites can narrow a caught error without importing apiClient directly. */
export { ApiError };
