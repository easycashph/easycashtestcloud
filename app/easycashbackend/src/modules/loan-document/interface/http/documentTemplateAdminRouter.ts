import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { validateBody } from '@shared/middleware/validate';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { DocumentTemplateAdminController, type DocumentTemplateAdminControllerDeps } from './documentTemplateAdminController';
import { updateDocumentTemplateRequiredSchema, setDocumentTemplateProductMappingsSchema } from './documentTemplateAdminSchemas';

/**
 * 2026-08-09 (Document Templates admin config, user request): lets MIS toggle a document
 * template between Required/Conditional and edit which Loan Products a Conditional template
 * applies to, without a developer re-editing `prisma/seed.ts` each time. Gated by
 * `document_template.manage` — a narrow, MIS-only-by-default admin permission (same posture as
 * `loan_product.write`), distinct from `document.generate` (any staff generating documents for a
 * loan) since this configures the rules everyone else's generation follows.
 */
export function createDocumentTemplateAdminRouter(deps: DocumentTemplateAdminControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new DocumentTemplateAdminController(deps);
  const requireAuth = createRequireAuth(tokenService);

  router.get('/document-templates/admin', requireAuth, requirePermission('document_template.manage'), controller.list);
  router.patch(
    '/document-templates/:id/required',
    requireAuth,
    requirePermission('document_template.manage'),
    validateBody(updateDocumentTemplateRequiredSchema),
    controller.updateRequired,
  );
  router.patch(
    '/document-templates/:id/product-mappings',
    requireAuth,
    requirePermission('document_template.manage'),
    validateBody(setDocumentTemplateProductMappingsSchema),
    controller.setProductMappings,
  );

  return router;
}
