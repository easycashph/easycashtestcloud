import * as React from 'react';
import { MotionConfig } from 'framer-motion';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { PortalDialogProvider } from '@/lib/portalDialogContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PortalDialogHost } from '@/components/PortalDialogHost';
import { PortalAnnouncementPopup } from '@/components/PortalAnnouncementPopup';
import { PortalChatWidget } from '@/components/PortalChatWidget';
import { LandingPage } from '@/pages/LandingPage';

/** The landing page is imported eagerly (above) because it is the entry point for almost every
 * visitor - lazy-loading it would only add a network round-trip before first paint.
 *
 * Everything else is code-split: a first-time visitor reading the landing page should not have to
 * download the loan application form, the dashboard, and the profile editor before seeing it.
 * This matters disproportionately here - much of the audience is on mobile data. */
const SignUpPage = React.lazy(() => import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const VerifyEmailPage = React.lazy(() => import('@/pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const LoginPage = React.lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ChangePasswordRequiredPage = React.lazy(() =>
  import('@/pages/ChangePasswordRequiredPage').then((m) => ({ default: m.ChangePasswordRequiredPage })),
);
const ForgotPasswordPage = React.lazy(() => import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LoanApplicationFormPage = React.lazy(() => import('@/pages/LoanApplicationFormPage').then((m) => ({ default: m.LoanApplicationFormPage })));
const LoanProductsPage = React.lazy(() => import('@/pages/LoanProductsPage').then((m) => ({ default: m.LoanProductsPage })));
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SecurityPage = React.lazy(() => import('@/pages/SecurityPage').then((m) => ({ default: m.SecurityPage })));
const PrivacyPolicyPage = React.lazy(() => import('@/pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = React.lazy(() => import('@/pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const SecurityTipsPage = React.lazy(() => import('@/pages/SecurityTipsPage').then((m) => ({ default: m.SecurityTipsPage })));
const ComplaintsPage = React.lazy(() => import('@/pages/ComplaintsPage').then((m) => ({ default: m.ComplaintsPage })));
const NewsPage = React.lazy(() => import('@/pages/NewsPage').then((m) => ({ default: m.NewsPage })));
const NewsArticlePage = React.lazy(() => import('@/pages/NewsArticlePage').then((m) => ({ default: m.NewsArticlePage })));
const RequirementsPage = React.lazy(() => import('@/pages/RequirementsPage').then((m) => ({ default: m.RequirementsPage })));
const ContactPage = React.lazy(() => import('@/pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const PortalSigningPage = React.lazy(() => import('@/pages/PortalSigningPage').then((m) => ({ default: m.PortalSigningPage })));
const NotFoundPage = React.lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

/** HashRouter, not BrowserRouter: GitHub Pages serves static files only (no server-side rewrite
 * to index.html for a deep link/refresh on a client-side route), and hash-based routes
 * (#/dashboard) never hit the server for anything but the initial index.html load, so this works
 * on GitHub Pages with zero extra configuration. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { account, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Bind existing Client data to Portal (2026-08-06): an account still on the shared staff-issued
  // temp password cannot reach ANY other authenticated page until it's changed - see
  // ChangePasswordRequiredPage's own doc comment for why this has no skip/dismiss option.
  if (account?.mustChangePassword) return <Navigate to="/change-password-required" replace />;
  return <>{children}</>;
}

/** Reachable only while `mustChangePassword` is true - once cleared, nothing routes here again, so
 * a direct visit just sends the client on to the dashboard instead of re-showing a stale form. */
function ChangePasswordRequiredRoute() {
  const { account, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!account?.mustChangePassword) return <Navigate to="/dashboard" replace />;
  return <ChangePasswordRequiredPage />;
}

/** Only shown once logged in - a visitor who hasn't signed up yet has no account for a loan
 * officer to chat with. */
function AuthenticatedChatWidget() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <PortalChatWidget />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password-required" element={<ChangePasswordRequiredRoute />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/security-tips" element={<SecurityTipsPage />} />
      <Route path="/complaints" element={<ComplaintsPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/:slug" element={<NewsArticlePage />} />
      <Route path="/requirements" element={<RequirementsPage />} />
      <Route path="/contact" element={<ContactPage />} />
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
      <Route
        path="/apply/:id"
        element={
          <ProtectedRoute>
            <LoanApplicationFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <LoanProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <SecurityPage />
          </ProtectedRoute>
        }
      />
      {/* 2026-08-20 (Portal e-signature, user request) - authenticated counterpart of
          lmsfrontend's public /sign/:token, reached from a "Sign Documents" prompt on the
          Dashboard instead of a mailed link. See PortalSigningPage's own doc comment. */}
      <Route
        path="/sign/:sessionId"
        element={
          <ProtectedRoute>
            <PortalSigningPage />
          </ProtectedRoute>
        }
      />
      {/* A real 404, not a silent redirect home - see NotFoundPage's doc comment. */}
      <Route path="*" element={<NotFoundPage />} />
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

/** Shown while a code-split route chunk is downloading. Deliberately minimal - a spinner that
 * appears for 100ms reads as a flicker, so this is a calm, centred placeholder rather than an
 * animation. `role="status"` announces the wait to screen readers. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <span className="text-sm text-muted-foreground">Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    /* framer-motion animates via inline transforms in JS, so the CSS prefers-reduced-motion rule
       in index.css cannot reach it. `reducedMotion="user"` makes every motion component honour the
       OS setting: transform/opacity animations are skipped, content still appears. */
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <HashRouter>
          <LanguageProvider>
            <AuthProvider>
              <PortalDialogProvider>
                {/* Lets keyboard and screen-reader users jump past the nav straight to the page
                    content (WCAG 2.4.1 "Bypass Blocks"). Visually hidden until focused. */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
                >
                  Skip to main content
                </a>
                <OfflineBanner />
                <PreviewBanner />
                {/* A plain div, not <main>: each page owns its own landmarks (the landing page
                    renders its own <header> nav, which must not sit inside <main>). tabIndex=-1
                    makes the skip link reliably move focus here in all browsers. */}
                <div id="main-content" tabIndex={-1} className="outline-none">
                  <React.Suspense fallback={<RouteFallback />}>
                    <AppRoutes />
                  </React.Suspense>
                </div>
                {/* 2026-07-31 (user request): "My Profile"/"Security"/loan application editing
                    open as a Dialog on top of the current page instead of navigating away - see
                    PortalDialogHost's own doc comment. */}
                <React.Suspense fallback={null}>
                  <PortalDialogHost />
                </React.Suspense>
                <AuthenticatedChatWidget />
                <PortalAnnouncementPopup />
              </PortalDialogProvider>
            </AuthProvider>
          </LanguageProvider>
        </HashRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}
