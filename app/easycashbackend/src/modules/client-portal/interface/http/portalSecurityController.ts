import type { NextFunction, Request, Response } from 'express';
import type { ChangePortalPasswordUseCase } from '../../application/use-cases/ChangePortalPasswordUseCase';
import type { ChangePortalEmailUseCase } from '../../application/use-cases/ChangePortalEmailUseCase';
import type { RequestEnablePortalTwoFactorUseCase } from '../../application/use-cases/RequestEnablePortalTwoFactorUseCase';
import type { ConfirmEnablePortalTwoFactorUseCase } from '../../application/use-cases/ConfirmEnablePortalTwoFactorUseCase';
import type { DisablePortalTwoFactorUseCase } from '../../application/use-cases/DisablePortalTwoFactorUseCase';
import type { ListPortalTrustedDevicesUseCase } from '../../application/use-cases/ListPortalTrustedDevicesUseCase';
import type { RevokePortalTrustedDeviceUseCase } from '../../application/use-cases/RevokePortalTrustedDeviceUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type {
  ChangePortalPasswordRequestBody,
  ChangePortalEmailRequestBody,
  RequestEnablePortalTwoFactorRequestBody,
  ConfirmEnablePortalTwoFactorRequestBody,
  DisablePortalTwoFactorRequestBody,
} from './portalSecuritySchemas';

export interface PortalSecurityControllerDeps {
  changePortalPasswordUseCase: ChangePortalPasswordUseCase;
  changePortalEmailUseCase: ChangePortalEmailUseCase;
  requestEnablePortalTwoFactorUseCase: RequestEnablePortalTwoFactorUseCase;
  confirmEnablePortalTwoFactorUseCase: ConfirmEnablePortalTwoFactorUseCase;
  disablePortalTwoFactorUseCase: DisablePortalTwoFactorUseCase;
  listPortalTrustedDevicesUseCase: ListPortalTrustedDevicesUseCase;
  revokePortalTrustedDeviceUseCase: RevokePortalTrustedDeviceUseCase;
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

  requestEnableTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as RequestEnablePortalTwoFactorRequestBody;
      const result = await this.deps.requestEnablePortalTwoFactorUseCase.execute({ portalAccountId: account.sub, channel: body.channel });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  confirmEnableTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as ConfirmEnablePortalTwoFactorRequestBody;
      await this.deps.confirmEnablePortalTwoFactorUseCase.execute({
        portalAccountId: account.sub,
        challengeId: body.challengeId,
        code: body.code,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  disableTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as DisablePortalTwoFactorRequestBody;
      await this.deps.disablePortalTwoFactorUseCase.execute({ portalAccountId: account.sub, currentPassword: body.currentPassword });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  listTrustedDevices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const devices = await this.deps.listPortalTrustedDevicesUseCase.execute(account.sub);
      res.status(200).json(devices);
    } catch (error) {
      next(error);
    }
  };

  revokeTrustedDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      await this.deps.revokePortalTrustedDeviceUseCase.execute(req.params.id as string, account.sub);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
