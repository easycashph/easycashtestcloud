import { Router } from 'express';
import multer from 'multer';
import type { IPortalTokenService } from '../../application/ports/IPortalTokenService';
import { createRequirePortalAuth } from './requirePortalAuth';
import { PortalLoanAccountController, type PortalLoanAccountControllerDeps } from './portalLoanAccountController';

// Same buffered-memory-storage/10MB-cap pattern as the document module's own multer wiring
// (documentRouter.ts / portalLoanApplicationRouter.ts).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Payment history / amortization schedule for a linked client's real, booked loan account(s)
 * (2026-07-31 user request). Mounted at the same /api/v1/portal prefix as every other portal
 * router. */
export function createPortalLoanAccountRouter(deps: PortalLoanAccountControllerDeps, portalTokenService: IPortalTokenService): Router {
  const router = Router();
  const controller = new PortalLoanAccountController(deps);
  const requirePortalAuth = createRequirePortalAuth(portalTokenService);

  router.get('/loan-accounts', requirePortalAuth, controller.list);
  // Registered before the ':id/...' route below - Express matches routes in registration order,
  // and 'next-payment-due' would otherwise be captured as an :id param by the more general route.
  router.get('/loan-accounts/next-payment-due', requirePortalAuth, controller.nextPaymentDue);
  router.get('/loan-accounts/recent-payments', requirePortalAuth, controller.recentPayments);
  // 2026-08-14 (Upload Proof of Payment) - deliberately not under '/loan-accounts/:id/...': the
  // client never supplies which loan account, see UploadPortalPaymentProofUseCase's doc comment.
  router.post('/loan-accounts/payment-proof', requirePortalAuth, upload.single('file'), controller.uploadPaymentProof);
  router.get('/loan-accounts/:id/installments', requirePortalAuth, controller.listInstallments);
  router.get('/loan-accounts/:id/statements-of-account', requirePortalAuth, controller.listStatementsOfAccount);
  router.get(
    '/loan-accounts/:id/statements-of-account/:generatedStatementId/download',
    requirePortalAuth,
    controller.downloadStatementOfAccount,
  );

  return router;
}
