import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoanListPage } from '@/pages/LoanListPage';
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
import { LmsConfigurationPage } from '@/pages/LmsConfigurationPage';
import { GeneratedDocumentsPage } from '@/pages/GeneratedDocumentsPage';
import { AboutPage } from '@/pages/AboutPage';

/**
 * Milestone 9.1 UI preview build (pre-CP13): every route below renders
 * against `src/lib/mockData.ts` only — nothing here calls `app/backend`.
 * No auth guard exists; `/login` is a static display screen the app never
 * actually requires passing through (see `LoginPage`'s own doc comment).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="loans" element={<LoanListPage />} />
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
        <Route path="admin/members" element={<MemberListPage />} />
        <Route path="admin/activity-logs" element={<ActivityLogPage />} />
        <Route path="admin/configuration" element={<LmsConfigurationPage />} />
        <Route path="admin/documents" element={<GeneratedDocumentsPage />} />
        <Route path="admin/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
