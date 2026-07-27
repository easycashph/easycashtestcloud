import type { NextFunction, Request, Response } from 'express';
import type { ChangePortalPasswordUseCase } from '../../application/use-cases/ChangePortalPasswordUseCase';
import type { ChangePortalEmailUseCase } from '../../application/use-cases/ChangePortalEmailUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type { ChangePortalPasswordRequestBody, ChangePortalEmailRequestBody } from './portalSecuritySchemas';

export interface PortalSecurityControllerDeps {
  changePortalPasswordUseCase: ChangePortalPasswordUseCase;
  changePortalEmailUseCase: ChangePortalEmailUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), mirrors every other portal controller's shape. */
export class PortalSecurityController {
  constructor(private readonly deps: PortalSecurityControllerDeps) {}

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as ChangePortalPasswordRequestBody;
      await this.deps.changePortalPasswordUseCase.execute(account.sub, body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  changeEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as ChangePortalEmailRequestBody;
      await this.deps.changePortalEmailUseCase.execute(account.sub, body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
