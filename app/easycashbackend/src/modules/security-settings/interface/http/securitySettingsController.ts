import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { GetSecuritySettingsUseCase } from '../../application/use-cases/GetSecuritySettingsUseCase';
import type { UpdateSecuritySettingsUseCase } from '../../application/use-cases/UpdateSecuritySettingsUseCase';
import { presentSecuritySettings } from './presenters/SecuritySettingsPresenter';

export interface SecuritySettingsControllerDeps {
  getSecuritySettingsUseCase: GetSecuritySettingsUseCase;
  updateSecuritySettingsUseCase: UpdateSecuritySettingsUseCase;
}

/** Both routes are MIS-only (enforced by the router's `requirePermission`) - matches
 * ReminderSettingsController's own convention. */
export class SecuritySettingsController {
  constructor(private readonly deps: SecuritySettingsControllerDeps) {}

  get = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await this.deps.getSecuritySettingsUseCase.execute();
      res.status(200).json(presentSecuritySettings(settings));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { enforceTwoFactorForAllUsers } = req.body as { enforceTwoFactorForAllUsers?: unknown };
      if (enforceTwoFactorForAllUsers !== undefined && typeof enforceTwoFactorForAllUsers !== 'boolean') {
        res.status(400).json({ error: 'enforceTwoFactorForAllUsers must be a boolean.' });
        return;
      }

      const currentUser = getCurrentUser(req);
      const settings = await this.deps.updateSecuritySettingsUseCase.execute({
        enforceTwoFactorForAllUsers,
        updatedByUserId: currentUser.sub,
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
      });
      res.status(200).json(presentSecuritySettings(settings));
    } catch (error) {
      next(error);
    }
  };
}
