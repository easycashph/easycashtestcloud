import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { LandingPage } from '@/pages/LandingPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoanApplicationFormPage } from '@/pages/LoanApplicationFormPage';

/** HashRouter, not BrowserRouter: GitHub Pages serves static files only (no server-side rewrite
 * to index.html for a deep link/refresh on a client-side route), and hash-based routes
 * (#/dashboard) never hit the server for anything but the initial index.html load, so this works
 * on GitHub Pages with zero extra configuration. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apply"
        element={
          <ProtectedRoute>
            <LoanApplicationFormPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Shown whenever the backend isn't reachable from the public internet yet (still localhost) -
 * remove once VITE_API_BASE_URL is pointed at a real public backend URL and the deploy workflow's
 * repo variable is set accordingly. */
function PreviewBanner() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
  if (!apiBaseUrl.includes('localhost')) return null;
  return (
    <div className="bg-amber-100 text-amber-900 text-center text-sm py-2 px-4">
      Preview build - sign up, login, and other account actions are not yet live.
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <PreviewBanner />
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  );
}
