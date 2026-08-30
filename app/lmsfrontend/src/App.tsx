import * as React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { useRole } from '@/lib/roleContext';
import { landingPagePath, readLandingPage } from '@/lib/landingPagePreference';

/**
 * Milestone 9.1 UI, ongoing frontend↔backend wiring (`docs/Architecture/
 * FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md`). `/login` is no longer a route: `RoleProvider` renders
 * `LoginPage` in place of this whole tree whenever there's no active session.
 *
 * Wiring status per route, current as of the 2026-07-12 mock-removal pass (see
 * `docs/SESSION_LOG_2026-07-12.md` Addendums 1-10 for the full history):
 * - Real, no mock fallback remaining: every route in this tree - DashboardPage (Collections vs.
 *   Target chart is the one exception, disclosed sample data pending a business decision on how a
 *   real monthly target gets set), LoanListPage, LoanApplications* (list/create/detail),
 *   ClientListPage, ClientProfilePage, LoanDetailPage, StatementOfAccountPage, LoanProductsPage
 *   (read-only by design), PaymentRecordingPage, PaymentRemindersPage, MemberListPage,
 *   ActivityLogPage, all *ReportPage routes, SettingsPage, AboutPage.
 * - `src/lib/mockData.ts` still exists for its genuinely-static config exports (`COMPANY_INFO`,
 *   payment method labels, intake document checklist) - not fake business data, see that file's
 *   own top-of-file comment.
 *
 * 2026-07-30 (user request, performance): every route below is now `React.lazy`-loaded instead of
 * statically imported - previously all 35 pages were bundled into one ~1.4 MB JS chunk (Vite's own
 * build warning), downloaded and parsed in full before *any* page could render, even just to show
 * Login or Dashboard. Route-based code-splitting means a visit only pays for the page(s) it
 * actually reaches. `lazyNamed` adapts each page's named export to the default export React.lazy
 * requires, since none of these files use `export default`.
 */
type PagelessComponent = React.ComponentType<Record<string, never>>;

function lazyNamed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factory: () => Promise<any>,
  exportName: string,
): React.LazyExoticComponent<PagelessComponent> {
  return React.lazy(() => factory().then((module) => ({ default: module[exportName] as PagelessComponent })));
}

const DashboardPage = lazyNamed(() => import('@/pages/DashboardPage'), 'DashboardPage');
const LoanListPage = lazyNamed(() => import('@/pages/LoanListPage'), 'LoanListPage');
const LoanAccountCreatePage = lazyNamed(() => import('@/pages/LoanAccountCreatePage'), 'LoanAccountCreatePage');
const LoanDetailPage = lazyNamed(() => import('@/pages/LoanDetailPage'), 'LoanDetailPage');
const LoanApplicationsPage = lazyNamed(() => import('@/pages/LoanApplicationsPage'), 'LoanApplicationsPage');
const LoanApplicationDetailPage = lazyNamed(() => import('@/pages/LoanApplicationDetailPage'), 'LoanApplicationDetailPage');
const LoanApplicationCreatePage = lazyNamed(() => import('@/pages/LoanApplicationCreatePage'), 'LoanApplicationCreatePage');
const LoanApplicationEditPage = lazyNamed(() => import('@/pages/LoanApplicationCreatePage'), 'LoanApplicationEditPage');
const PaymentRemindersPage = lazyNamed(() => import('@/pages/PaymentRemindersPage'), 'PaymentRemindersPage');
const ReminderLogsPage = lazyNamed(() => import('@/pages/ReminderLogsPage'), 'ReminderLogsPage');
const EsignatureLogsPage = lazyNamed(() => import('@/pages/EsignatureLogsPage'), 'EsignatureLogsPage');
const PaymentRecordingPage = lazyNamed(() => import('@/pages/PaymentRecordingPage'), 'PaymentRecordingPage');
const ClientListPage = lazyNamed(() => import('@/pages/ClientListPage'), 'ClientListPage');
const ClientCreatePage = lazyNamed(() => import('@/pages/ClientCreatePage'), 'ClientCreatePage');
const ClientProfilePage = lazyNamed(() => import('@/pages/ClientProfilePage'), 'ClientProfilePage');
const StatementOfAccountPage = lazyNamed(() => import('@/pages/StatementOfAccountPage'), 'StatementOfAccountPage');
const LoanReportPage = lazyNamed(() => import('@/pages/LoanReportPage'), 'LoanReportPage');
const CollectionReportPage = lazyNamed(() => import('@/pages/CollectionReportPage'), 'CollectionReportPage');
const TransactionReportPage = lazyNamed(() => import('@/pages/TransactionReportPage'), 'TransactionReportPage');
const LoanReleasesReportPage = lazyNamed(() => import('@/pages/LoanReleasesReportPage'), 'LoanReleasesReportPage');
const AgingReportPage = lazyNamed(() => import('@/pages/AgingReportPage'), 'AgingReportPage');
const EndingBalanceReportPage = lazyNamed(() => import('@/pages/EndingBalanceReportPage'), 'EndingBalanceReportPage');
const AccountsWithPastDueReportPage = lazyNamed(() => import('@/pages/AccountsWithPastDueReportPage'), 'AccountsWithPastDueReportPage');
const CollectionHistoryReportPage = lazyNamed(() => import('@/pages/CollectionHistoryReportPage'), 'CollectionHistoryReportPage');
const ExpectedCollectionReportPage = lazyNamed(() => import('@/pages/ExpectedCollectionReportPage'), 'ExpectedCollectionReportPage');
const FirstAmortizationReportPage = lazyNamed(() => import('@/pages/FirstAmortizationReportPage'), 'FirstAmortizationReportPage');
const DailyCollectionReportPage = lazyNamed(() => import('@/pages/DailyCollectionReportPage'), 'DailyCollectionReportPage');
const FullyPaidAccountsReportPage = lazyNamed(() => import('@/pages/FullyPaidAccountsReportPage'), 'FullyPaidAccountsReportPage');
const PortalAccountsReportPage = lazyNamed(() => import('@/pages/PortalAccountsReportPage'), 'PortalAccountsReportPage');
const CicMonthlyReportPage = lazyNamed(() => import('@/pages/CicMonthlyReportPage'), 'CicMonthlyReportPage');
const ReportsHubPage = lazyNamed(() => import('@/pages/ReportsHubPage'), 'ReportsHubPage');
const SettingsPage = lazyNamed(() => import('@/pages/SettingsPage'), 'SettingsPage');
const SystemPage = lazyNamed(() => import('@/pages/SystemPage'), 'SystemPage');
const AboutPage = lazyNamed(() => import('@/pages/AboutPage'), 'AboutPage');
const ChatPage = lazyNamed(() => import('@/pages/ChatPage'), 'ChatPage');
const BulkExportsPage = lazyNamed(() => import('@/pages/BulkExportsPage'), 'BulkExportsPage');

/** Bare, dependency-free fallback shown only for the brief window a lazy chunk is downloading -
 * deliberately not a full skeleton (that's each page's own job once it renders) since this can
 * appear for any route, layout-less. */
function RouteLoadingFallback() {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>;
}

/**
 * Settings > Appearance > Landing Page (2026-07-17): sends the signed-in officer straight to their
 * preferred page instead of always Dashboard. Read once per mount (this component only exists on
 * the index route, which unmounts/remounts on every login via RoleProvider swapping this whole
 * tree in) - no live-update needed while already sitting on the landing page.
 */
function IndexRedirect() {
  const { currentAccount } = useRole();
  const preferred = readLandingPage(currentAccount.id);
  const path = landingPagePath(preferred);
  if (path === '/') return <DashboardPage />;
  return <Navigate to={path} replace />;
}

export default function App() {
  return (
    <React.Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<IndexRedirect />} />
          <Route path="loans" element={<LoanListPage />} />
          <Route path="loans/new" element={<LoanAccountCreatePage />} />
          <Route path="loans/:loanId" element={<LoanDetailPage />} />
          <Route path="applications" element={<LoanApplicationsPage />} />
          <Route path="applications/new" element={<LoanApplicationCreatePage />} />
          <Route path="applications/:applicationId/edit" element={<LoanApplicationEditPage />} />
          <Route path="applications/:applicationId" element={<LoanApplicationDetailPage />} />
          <Route path="reminders" element={<PaymentRemindersPage />} />
          <Route path="loans/:loanId/soa" element={<StatementOfAccountPage />} />
          <Route path="clients" element={<ClientListPage />} />
          <Route path="clients/new" element={<ClientCreatePage />} />
          <Route path="clients/:borrowerId" element={<ClientProfilePage />} />
          <Route path="products" element={<Navigate to="/admin/system?tab=products" replace />} />
          <Route path="payments" element={<PaymentRecordingPage />} />
          <Route path="reports" element={<ReportsHubPage />} />
          <Route path="reports/loans" element={<LoanReportPage />} />
          <Route path="reports/collections" element={<CollectionReportPage />} />
          <Route path="reports/transactions" element={<TransactionReportPage />} />
          <Route path="reports/loan-releases" element={<LoanReleasesReportPage />} />
          <Route path="reports/aging" element={<AgingReportPage />} />
          <Route path="reports/ending-balance" element={<EndingBalanceReportPage />} />
          <Route path="reports/accounts-past-due" element={<AccountsWithPastDueReportPage />} />
          <Route path="reports/collection-history" element={<CollectionHistoryReportPage />} />
          <Route path="reports/expected-collection" element={<ExpectedCollectionReportPage />} />
          <Route path="reports/first-amortization" element={<FirstAmortizationReportPage />} />
          <Route path="reports/daily-collection" element={<DailyCollectionReportPage />} />
          <Route path="reports/fully-paid" element={<FullyPaidAccountsReportPage />} />
          <Route path="reports/portal-accounts" element={<PortalAccountsReportPage />} />
          <Route path="reports/cic-monthly" element={<CicMonthlyReportPage />} />
          <Route path="reports/reminder-logs" element={<ReminderLogsPage />} />
          <Route path="reports/esignature-logs" element={<EsignatureLogsPage />} />
          <Route path="configuration/settings" element={<SettingsPage />} />
          <Route path="admin/members" element={<Navigate to="/admin/system?tab=members" replace />} />
          <Route path="admin/activity-logs" element={<Navigate to="/admin/system?tab=activity-logs" replace />} />
          <Route path="admin/system" element={<SystemPage />} />
          <Route path="admin/about" element={<Navigate to="/support/about" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="exports" element={<BulkExportsPage />} />
          <Route path="support/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </React.Suspense>
  );
}
