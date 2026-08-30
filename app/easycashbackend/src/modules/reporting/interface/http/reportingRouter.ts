import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { ReportingController, type ReportingControllerDeps } from './reportingController';

/** Read-only. 2026-08-22 (user request): each report is gated by its OWN permission code
 * (`report.<name>.view`) instead of the single blanket `report.view` this router used until now -
 * lets MIS grant/restrict individual reports per role instead of all-or-nothing. Default grant for
 * every role that previously had `report.view` is all 13 codes (see seed.ts's
 * `ALL_REPORT_PERMISSIONS`), preserving "sees every report" as the starting point. Branch scoping
 * (separate from permission gating) still restricts a non-MIS user to their own branch, mirroring
 * the dashboard module. Reminder Logs/E-signature Logs are separate routers with no permission
 * gate at all yet - deliberately out of scope for this change. */
export function createReportingRouter(deps: ReportingControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ReportingController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/reports/loan-origination', requireAuth, requirePermission('report.loan_origination.view'), controller.loanOrigination);
  router.get('/reports/collections', requireAuth, requirePermission('report.collections.view'), controller.collections);
  router.get('/reports/transactions', requireAuth, requirePermission('report.transactions.view'), controller.transactions);
  router.get('/reports/transactions/channels', requireAuth, requirePermission('report.transactions.view'), controller.channels);
  router.get('/reports/loan-releases', requireAuth, requirePermission('report.loan_releases.view'), controller.loanReleases);
  router.get('/reports/loan-releases.xlsx', requireAuth, requirePermission('report.loan_releases.view'), controller.loanReleasesXlsx);
  router.get('/reports/aging.xlsx', requireAuth, requirePermission('report.aging.view'), controller.agingXlsx);
  router.get('/reports/ending-balance.xlsx', requireAuth, requirePermission('report.ending_balance.view'), controller.endingBalanceXlsx);
  router.get('/reports/accounts-past-due', requireAuth, requirePermission('report.accounts_past_due.view'), controller.accountsWithPastDue);
  router.get(
    '/reports/accounts-past-due.xlsx',
    requireAuth,
    requirePermission('report.accounts_past_due.view'),
    controller.accountsWithPastDueXlsx,
  );
  router.get('/reports/collection-history', requireAuth, requirePermission('report.collection_history.view'), controller.collectionHistory);
  router.get(
    '/reports/collection-history.xlsx',
    requireAuth,
    requirePermission('report.collection_history.view'),
    controller.collectionHistoryXlsx,
  );
  router.get('/reports/expected-collection', requireAuth, requirePermission('report.expected_collection.view'), controller.expectedCollection);
  router.get(
    '/reports/expected-collection.xlsx',
    requireAuth,
    requirePermission('report.expected_collection.view'),
    controller.expectedCollectionXlsx,
  );
  router.get('/reports/first-amortization', requireAuth, requirePermission('report.first_amortization.view'), controller.firstAmortization);
  router.get(
    '/reports/first-amortization.xlsx',
    requireAuth,
    requirePermission('report.first_amortization.view'),
    controller.firstAmortizationXlsx,
  );
  router.get('/reports/daily-collection', requireAuth, requirePermission('report.daily_collection.view'), controller.dailyCollection);
  router.get('/reports/daily-collection.xlsx', requireAuth, requirePermission('report.daily_collection.view'), controller.dailyCollectionXlsx);
  router.get('/reports/fully-paid', requireAuth, requirePermission('report.fully_paid.view'), controller.fullyPaid);
  router.get('/reports/fully-paid.xlsx', requireAuth, requirePermission('report.fully_paid.view'), controller.fullyPaidXlsx);
  router.get('/reports/portal-accounts', requireAuth, requirePermission('report.portal_accounts.view'), controller.portalAccounts);
  router.get('/reports/portal-accounts.xlsx', requireAuth, requirePermission('report.portal_accounts.view'), controller.portalAccountsXlsx);
  router.get('/reports/cic-monthly', requireAuth, requirePermission('report.cic_monthly.view'), controller.cicMonthly);
  router.get('/reports/cic-monthly.csv', requireAuth, requirePermission('report.cic_monthly.view'), controller.cicMonthlyCsv);
  router.get('/reports/cic-monthly.xlsx', requireAuth, requirePermission('report.cic_monthly.view'), controller.cicMonthlyXlsx);

  return router;
}
