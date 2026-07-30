import * as React from 'react';
import { apiClient, clearStoredToken, getStoredToken, setStoredToken } from './apiClient';
import type { MeResponse, PortalAccountView } from './portalApiTypes';

interface AuthContextValue {
  account: MeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (accessToken: string, account: PortalAccountView) => void;
  logout: () => void;
  refreshAccount: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = React.useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiClient
      .get<MeResponse>('/portal/me')
      .then((me) => setAccount(me))
      .catch(() => clearStoredToken())
      .finally(() => setIsLoading(false));
  }, []);

  const login = React.useCallback((accessToken: string, acct: PortalAccountView) => {
    setStoredToken(accessToken);
    setAccount(acct);
  }, []);

  const logout = React.useCallback(() => {
    clearStoredToken();
    setAccount(null);
  }, []);

  // 2026-07-30: apiClient dispatches this on any 401 from an authenticated call (invalid/expired/
  // corrupted token) - without this, the app kept showing the authenticated shell with every
  // subsequent call silently failing instead of dropping back to the login screen.
  React.useEffect(() => {
    const onSessionExpired = () => setAccount(null);
    window.addEventListener('easycash-portal-session-expired', onSessionExpired);
    return () => window.removeEventListener('easycash-portal-session-expired', onSessionExpired);
  }, []);

  const refreshAccount = React.useCallback(async () => {
    if (!getStoredToken()) return;
    const me = await apiClient.get<MeResponse>('/portal/me');
    setAccount(me);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ account, isLoading, isAuthenticated: account !== null, login, logout, refreshAccount }),
    [account, isLoading, login, logout, refreshAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
