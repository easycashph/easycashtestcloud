import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoanListPage } from '@/pages/LoanListPage';
import { LoanAccountCreatePage } from '@/pages/LoanAccountCreatePage';
import { LoanDetailPage } from '@/pages/LoanDetailPage';
import { LoanApplicationsPage } from '@/pages/LoanApplicationsPage';
import { LoanApplicationDetailPage } from '@/pages/LoanApplicationDetailPage';
import { LoanApplicationCreatePage } from '@/pages/LoanApplicationCreatePage';
import { PaymentRemindersPage } from '@/pages/PaymentRemindersPage';
import { PaymentRecordingPage } from '@/pages/PaymentRecordingPage';
import { ClientListPage } from '@/pages/ClientListPage';
import { ClientProfilePage } from '@/pages/ClientProfilePage';
import { LoanProductsPage } from '@/pages/LoanProductsPage';
import { StatementOfAccountPage } from '@/pages/StatementOfAccountPage';
import { LoanReportPage } from '@/pages/LoanReportPage';
import { CollectionReportPage } from '@/pages/CollectionReportPage';
import { TransactionReportPage } from '@/pages/TransactionReportPage';
import { MemberListPage } from '@/pages/MemberListPage';
import { ActivityLogPage } from '@/pages/ActivityLogPage';
import { SettingsPage } from '@/pages/SettingsPage';
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
export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="loans" element={<LoanListPage />} />
        <Route path="loans/new" element={<LoanAccountCreatePage />} />
        <Route path="loans/:loanId" element={<LoanDetailPage />} />
        <Route path="applications" element={<LoanApplicationsPage />} />
        <Route path="applications/new" element={<LoanApplicationCreatePage />} />
        <Route path="applications/:applicationId" element={<LoanApplicationDetailPage />} />
        <Route path="reminders" element={<PaymentRemindersPage />} />
        <Route path="loans/:loanId/soa" element={<StatementOfAccountPage />} />
        <Route path="clients" element={<ClientListPage />} />
        <Route path="clients/:borrowerId" element={<ClientProfilePage />} />
        <Route path="products" element={<LoanProductsPage />} />
        <Route path="payments" element={<PaymentRecordingPage />} />
        <Route path="reports/loans" element={<LoanReportPage />} />
        <Route path="reports/collections" element={<CollectionReportPage />} />
        <Route path="reports/transactions" element={<TransactionReportPage />} />
        <Route path="configuration/settings" element={<SettingsPage />} />
        <Route path="admin/members" element={<MemberListPage />} />
        <Route path="admin/activity-logs" element={<ActivityLogPage />} />
        <Route path="admin/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
