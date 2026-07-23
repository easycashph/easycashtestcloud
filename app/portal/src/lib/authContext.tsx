import * as React from 'react';
import { apiClient, clearStoredToken, getStoredToken, setStoredToken } from './apiClient';
import type { MeResponse, PortalAccountView } from './portalApiTypes';

interface AuthContextValue {
  account: MeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (accessToken: string, account: PortalAccountView) => void;
  logout: () => void;
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

  const value = React.useMemo<AuthContextValue>(
    () => ({ account, isLoading, isAuthenticated: account !== null, login, logout }),
    [account, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
