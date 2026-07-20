import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { GetReminderSettingsUseCase } from '../../application/use-cases/GetReminderSettingsUseCase';
import type { UpdateReminderSettingsUseCase } from '../../application/use-cases/UpdateReminderSettingsUseCase';
import { presentReminderSettings } from './presenters/ReminderSettingsPresenter';

export interface ReminderSettingsControllerDeps {
  getReminderSettingsUseCase: GetReminderSettingsUseCase;
  updateReminderSettingsUseCase: UpdateReminderSettingsUseCase;
}

/** Both routes are MIS-only (enforced by the router's `requireRole('MIS')`) - matches the user's
 * explicit request that only MIS can see/change these switches. */
export class ReminderSettingsController {
  constructor(private readonly deps: ReminderSettingsControllerDeps) {}

  get = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await this.deps.getReminderSettingsUseCase.execute();
      res.status(200).json(presentReminderSettings(settings));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { smsEnabled, emailEnabled } = req.body as { smsEnabled?: unknown; emailEnabled?: unknown };
      if (smsEnabled !== undefined && typeof smsEnabled !== 'boolean') {
        res.status(400).json({ error: 'smsEnabled must be a boolean.' });
        return;
      }
      if (emailEnabled !== undefined && typeof emailEnabled !== 'boolean') {
        res.status(400).json({ error: 'emailEnabled must be a boolean.' });
        return;
      }

      const currentUser = getCurrentUser(req);
      const settings = await this.deps.updateReminderSettingsUseCase.execute({
        smsEnabled,
        emailEnabled,
        updatedByUserId: currentUser.sub,
      });
      res.status(200).json(presentReminderSettings(settings));
    } catch (error) {
      next(error);
    }
  };
}
