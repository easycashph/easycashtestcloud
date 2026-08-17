import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { ReportingController, type ReportingControllerDeps } from './reportingController';

/** Read-only. 2026-08-06: gated by `report.view` (Roles & Permissions feature) — previously every
 * authenticated role could view, unconditionally. Default grant is every role (preserving that
 * behavior), configurable by MIS from there. Branch scoping (separate from role gating) still
 * restricts a non-MIS user to their own branch, mirroring the dashboard module. */
export function createReportingRouter(deps: ReportingControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ReportingController(deps);
  const requireAuth = createRequireAuth(tokenService);
  const requireReportView = requirePermission('report.view');

  router.get('/reports/loan-origination', requireAuth, requireReportView, controller.loanOrigination);
  router.get('/reports/collections', requireAuth, requireReportView, controller.collections);
  router.get('/reports/transactions', requireAuth, requireReportView, controller.transactions);
  router.get('/reports/transactions/channels', requireAuth, requireReportView, controller.channels);
  router.get('/reports/loan-releases', requireAuth, requireReportView, controller.loanReleases);
  router.get('/reports/loan-releases.xlsx', requireAuth, requireReportView, controller.loanReleasesXlsx);
  router.get('/reports/aging.xlsx', requireAuth, requireReportView, controller.agingXlsx);
  router.get('/reports/ending-balance.xlsx', requireAuth, requireReportView, controller.endingBalanceXlsx);
  router.get('/reports/accounts-past-due.xlsx', requireAuth, requireReportView, controller.accountsWithPastDueXlsx);
  router.get('/reports/collection-history.xlsx', requireAuth, requireReportView, controller.collectionHistoryXlsx);
  router.get('/reports/expected-collection.xlsx', requireAuth, requireReportView, controller.expectedCollectionXlsx);
  router.get('/reports/first-amortization.xlsx', requireAuth, requireReportView, controller.firstAmortizationXlsx);
  router.get('/reports/daily-collection.xlsx', requireAuth, requireReportView, controller.dailyCollectionXlsx);
  router.get('/reports/fully-paid.xlsx', requireAuth, requireReportView, controller.fullyPaidXlsx);

  return router;
}
