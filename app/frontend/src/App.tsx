import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { useRole } from '@/lib/roleContext';
import { landingPagePath, readLandingPage } from '@/lib/landingPagePreference';
import { LoanListPage } from '@/pages/LoanListPage';
import { LoanAccountCreatePage } from '@/pages/LoanAccountCreatePage';
import { LoanDetailPage } from '@/pages/LoanDetailPage';
import { LoanApplicationsPage } from '@/pages/LoanApplicationsPage';
import { LoanApplicationDetailPage } from '@/pages/LoanApplicationDetailPage';
import { LoanApplicationCreatePage } from '@/pages/LoanApplicationCreatePage';
import { PaymentRemindersPage } from '@/pages/PaymentRemindersPage';
import { ReminderLogsPage } from '@/pages/ReminderLogsPage';
import { PaymentRecordingPage } from '@/pages/PaymentRecordingPage';
import { ClientListPage } from '@/pages/ClientListPage';
import { ClientCreatePage } from '@/pages/ClientCreatePage';
import { ClientProfilePage } from '@/pages/ClientProfilePage';
import { StatementOfAccountPage } from '@/pages/StatementOfAccountPage';
import { LoanReportPage } from '@/pages/LoanReportPage';
import { CollectionReportPage } from '@/pages/CollectionReportPage';
import { TransactionReportPage } from '@/pages/TransactionReportPage';
import { LoanReleasesReportPage } from '@/pages/LoanReleasesReportPage';
import { AgingReportPage } from '@/pages/AgingReportPage';
import { EndingBalanceReportPage } from '@/pages/EndingBalanceReportPage';
import { AccountsWithPastDueReportPage } from '@/pages/AccountsWithPastDueReportPage';
import { CollectionHistoryReportPage } from '@/pages/CollectionHistoryReportPage';
import { ExpectedCollectionReportPage } from '@/pages/ExpectedCollectionReportPage';
import { FirstAmortizationReportPage } from '@/pages/FirstAmortizationReportPage';
import { DailyCollectionReportPage } from '@/pages/DailyCollectionReportPage';
import { FullyPaidAccountsReportPage } from '@/pages/FullyPaidAccountsReportPage';
import { ReportsHubPage } from '@/pages/ReportsHubPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SystemPage } from '@/pages/SystemPage';
import { AboutPage } from '@/pages/AboutPage';

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
 */
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
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<IndexRedirect />} />
        <Route path="loans" element={<LoanListPage />} />
        <Route path="loans/new" element={<LoanAccountCreatePage />} />
        <Route path="loans/:loanId" element={<LoanDetailPage />} />
        <Route path="applications" element={<LoanApplicationsPage />} />
        <Route path="applications/new" element={<LoanApplicationCreatePage />} />
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
        <Route path="reports/reminder-logs" element={<ReminderLogsPage />} />
        <Route path="configuration/settings" element={<SettingsPage />} />
        <Route path="admin/members" element={<Navigate to="/admin/system?tab=members" replace />} />
        <Route path="admin/activity-logs" element={<Navigate to="/admin/system?tab=activity-logs" replace />} />
        <Route path="admin/system" element={<SystemPage />} />
        <Route path="admin/about" element={<Navigate to="/support/about" replace />} />
        <Route path="support/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
