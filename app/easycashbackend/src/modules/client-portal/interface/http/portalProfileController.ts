import type { NextFunction, Request, Response } from 'express';
import type { GetPortalProfileUseCase } from '../../application/use-cases/GetPortalProfileUseCase';
import type { UpdatePortalProfileUseCase } from '../../application/use-cases/UpdatePortalProfileUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type { UpdatePortalProfileRequestBody } from './portalProfileSchemas';

export interface PortalProfileControllerDeps {
  getPortalProfileUseCase: GetPortalProfileUseCase;
  updatePortalProfileUseCase: UpdatePortalProfileUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), mirrors every other
 * portal controller's shape. Both use cases now return a ready-to-serialize PortalProfileDto
 * directly (2026-07-30) - see GetPortalProfileUseCase's own doc comment for why the presentation
 * mapping moved into the application layer. */
export class PortalProfileController {
  constructor(private readonly deps: PortalProfileControllerDeps) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const profile = await this.deps.getPortalProfileUseCase.execute(account.sub);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as UpdatePortalProfileRequestBody;
      const profile = await this.deps.updatePortalProfileUseCase.execute(account.sub, body);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  };
}
