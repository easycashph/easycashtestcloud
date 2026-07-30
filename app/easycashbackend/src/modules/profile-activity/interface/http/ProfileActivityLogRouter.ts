/**
 * Profile Activity Log Router
 *
 * Routes:
 *   GET /loan-applications/:profileId/activity
 *   GET /borrowers/:profileId/activity
 *   GET /loan-accounts/:profileId/activity
 *   DELETE /profile-activity/:activityId (MIS only)
 */

import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { Router } from 'express';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requireRole } from '@shared/middleware/requireRole';
import type { ProfileActivityLogController } from './ProfileActivityLogController';

export function createProfileActivityLogRouter(
  controller: ProfileActivityLogController,
  tokenService: ITokenService,
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(tokenService);

  /**
   * GET /loan-applications/:profileId/activity
   * Get activity timeline for a loan application
   */
  router.get(
    '/loan-applications/:profileId/activity',
    requireAuth,
    async (req, res) => {
      (req as any).params.profileType = 'LOAN_APPLICATION';
      await controller.getProfileActivity(req, res);
    },
  );

  /**
   * GET /borrowers/:profileId/activity
   * Get activity timeline for a borrower/client
   */
  router.get(
    '/borrowers/:profileId/activity',
    requireAuth,
    async (req, res) => {
      (req as any).params.profileType = 'BORROWER';
      await controller.getProfileActivity(req, res);
    },
  );

  /**
   * GET /loan-accounts/:profileId/activity
   * Get activity timeline for a loan account
   */
  router.get(
    '/loan-accounts/:profileId/activity',
    requireAuth,
    async (req, res) => {
      (req as any).params.profileType = 'LOAN_ACCOUNT';
      await controller.getProfileActivity(req, res);
    },
  );

  /**
   * DELETE /profile-activity/:activityId
   * Soft-delete a profile activity record (MIS only)
   */
  router.delete(
    '/profile-activity/:activityId',
    requireAuth,
    requireRole('MIS'),
    async (req, res) => {
      await controller.deleteProfileActivity(req, res);
    },
  );

  return router;
}
