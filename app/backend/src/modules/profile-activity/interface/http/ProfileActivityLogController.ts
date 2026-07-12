/**
 * Profile Activity Log HTTP Controller
 */

import type { Request, Response } from 'express';
import { GetProfileActivityUseCase } from '../../application/use-cases/GetProfileActivityUseCase';
import { DeleteProfileActivityUseCase } from '../../application/use-cases/DeleteProfileActivityUseCase';
import { ProfileActivityPresenter } from './presenters/ProfileActivityPresenter';
import type { ProfileType } from '../../domain/ProfileActivityLog';

export class ProfileActivityLogController {
  constructor(
    private readonly getProfileActivityUseCase: GetProfileActivityUseCase,
    private readonly deleteProfileActivityUseCase: DeleteProfileActivityUseCase,
  ) {}

  /**
   * GET /:profileType/:profileId/activity
   * Retrieve activity timeline for a profile.
   * Query params: ?limit=50&cursor=...&action=payment_recorded
   */
  async getProfileActivity(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as { profileType?: string; profileId?: string };
      const { profileType, profileId } = params;
      const { limit, cursor, action } = req.query;

      if (!profileType || !profileId) {
        res.status(400).json({ error: 'Missing profileType or profileId' });
        return;
      }

      const result = await this.getProfileActivityUseCase.execute({
        profileType: profileType as ProfileType,
        profileId,
        limit: limit ? parseInt(limit as string, 10) : 50,
        cursor: cursor ? (cursor as string) : undefined,
        action: action ? (action as string) : undefined,
      });

      res.json({
        activities: result.activities.map((activity) => ({
          ...activity,
          createdAt: activity.createdAt.toISOString(),
          deletedByMisAt: activity.deletedByMisAt?.toISOString() ?? null,
          formattedAction: ProfileActivityPresenter.formatActionLabel(activity.action, activity.details),
        })),
        cursor: result.cursor,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * DELETE /activity/:activityId
   * Soft-delete a profile activity record (MIS only).
   */
  async deleteProfileActivity(req: Request, res: Response): Promise<void> {
    try {
      const params = req.params as { activityId?: string };
      const { activityId } = params;
      const userId = req.authUser?.sub;

      if (!activityId) {
        res.status(400).json({ error: 'Missing activityId' });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.deleteProfileActivityUseCase.execute({
        activityId,
        requestedByUserId: userId,
      });

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
