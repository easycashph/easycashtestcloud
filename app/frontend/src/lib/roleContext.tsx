import * as React from 'react';
import { apiClient, ApiError, setAccessToken, setOnSessionExpired } from './apiClient';
import type { AuthenticatedUserView, LoginResponse, RefreshResponse } from './authTypes';
import { useTheme } from '@/components/theme-provider';
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
        setAccessToken(refreshed.accessToken);
        const me = await apiClient.get<AuthenticatedUserView>('/auth/me');
        if (cancelled || loggedInRef.current) return;
        setUser(me);
        loadPreferenceFor(me.id);
        setStatus('authenticated');
      } catch {
        if (cancelled || loggedInRef.current) return;
        setAccessToken(null);
        loadPreferenceFor(null);
        setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Bootstrap runs once on mount only - loadPreferenceFor is a stable useCallback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const result = await apiClient.post<LoginResponse>('/auth/login', { email, password });
      loggedInRef.current = true;
      setAccessToken(result.accessToken);
      setUser(result.user);
      loadPreferenceFor(result.user.id);
      setStatus('authenticated');
    },
    [loadPreferenceFor],
  );

  const logout = React.useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Best-effort - even if the network call fails, clear local session state below so the
      // user isn't stuck "logged in" against a UI that can no longer reach the backend.
    }
    setAccessToken(null);
    setUser(null);
    loadPreferenceFor(null);
    setStatus('unauthenticated');
  }, [loadPreferenceFor]);

  // Without this, a session that goes bad mid-use (refresh token expired, or revoked via the
  // backend's rotation-reuse detection) left every page silently 401-ing forever with no way to
  // recover except a manual hard reload - `apiClient.ts`'s `onSessionExpired` hook fires exactly
  // once per failed background refresh, and this bounces the user back to the Login page instead.
  React.useEffect(() => {
    setOnSessionExpired(() => {
      setAccessToken(null);
      setUser(null);
      loadPreferenceFor(null);
      setStatus('unauthenticated');
    });
    return () => setOnSessionExpired(null);
  }, [loadPreferenceFor]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <LoginPage onLogin={login} />;
  }

  const currentAccount = toAccount(user);
  const value: RoleContextValue = {
    currentAccount,
    role: currentAccount.role,
    logout,
    canManageMembers: currentAccount.roles.includes('MIS'),
    canAccessLoanApplications: currentAccount.roles.some((r) => r === 'MIS' || r === 'Loan Operation Manager' || r === 'CRM'),
    canRevertLoanApplicationDecision: currentAccount.roles.includes('MIS'),
    canViewActivityLogs: currentAccount.roles.includes('MIS'),
    canCreateLoanAccount: currentAccount.roles.some((r) => r === 'MIS' || r === 'Loan Operation Manager' || r === 'CRM'),
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
