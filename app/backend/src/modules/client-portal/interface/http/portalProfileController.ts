import type { NextFunction, Request, Response } from 'express';
import type { GetPortalProfileUseCase } from '../../application/use-cases/GetPortalProfileUseCase';
import type { UpdatePortalProfileUseCase } from '../../application/use-cases/UpdatePortalProfileUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type { UpdatePortalProfileRequestBody } from './portalProfileSchemas';
import { presentPortalProfile } from './presenters/PortalProfilePresenter';

export interface PortalProfileControllerDeps {
  getPortalProfileUseCase: GetPortalProfileUseCase;
  updatePortalProfileUseCase: UpdatePortalProfileUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), mirrors every other portal controller's shape. */
export class PortalProfileController {
  constructor(private readonly deps: PortalProfileControllerDeps) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const borrower = await this.deps.getPortalProfileUseCase.execute(account.sub);
      res.status(200).json(presentPortalProfile(borrower));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as UpdatePortalProfileRequestBody;
      const borrower = await this.deps.updatePortalProfileUseCase.execute(account.sub, body);
      res.status(200).json(presentPortalProfile(borrower));
    } catch (error) {
      next(error);
    }
  };
}
