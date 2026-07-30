import type { NextFunction, Request, Response } from 'express';
import type { SignUpUseCase } from '../../application/use-cases/SignUpUseCase';
import type { VerifySignUpUseCase } from '../../application/use-cases/VerifySignUpUseCase';
import type { PortalLoginUseCase } from '../../application/use-cases/PortalLoginUseCase';
import type { VerifyPortalLoginOtpUseCase } from '../../application/use-cases/VerifyPortalLoginOtpUseCase';
import type { RequestPasswordResetUseCase } from '../../application/use-cases/RequestPasswordResetUseCase';
import type { ConfirmPasswordResetUseCase } from '../../application/use-cases/ConfirmPasswordResetUseCase';
import type { GetPortalAccountUseCase } from '../../application/use-cases/GetPortalAccountUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type {
  PortalConfirmPasswordResetRequestBody,
  PortalLoginRequestBody,
  PortalRequestPasswordResetRequestBody,
  PortalSignUpRequestBody,
  PortalVerifyLoginOtpRequestBody,
  PortalVerifySignUpRequestBody,
} from './portalAuthSchemas';

export interface PortalAuthControllerDeps {
  signUpUseCase: SignUpUseCase;
  verifySignUpUseCase: VerifySignUpUseCase;
  portalLoginUseCase: PortalLoginUseCase;
  verifyPortalLoginOtpUseCase: VerifyPortalLoginOtpUseCase;
  requestPasswordResetUseCase: RequestPasswordResetUseCase;
  confirmPasswordResetUseCase: ConfirmPasswordResetUseCase;
  getPortalAccountUseCase: GetPortalAccountUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class PortalAuthController {
  constructor(private readonly deps: PortalAuthControllerDeps) {}

  signUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as PortalSignUpRequestBody;
      const result = await this.deps.signUpUseCase.execute(body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  verifySignUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as PortalVerifySignUpRequestBody;
      await this.deps.verifySignUpUseCase.execute(body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as PortalLoginRequestBody;
      const result = await this.deps.portalLoginUseCase.execute(body);
      if ('twoFactorRequired' in result) {
        res.status(200).json(result);
        return;
      }
      res.status(200).json({
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
        account: result.account,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyLoginOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as PortalVerifyLoginOtpRequestBody;
      const result = await this.deps.verifyPortalLoginOtpUseCase.execute(body);
      res.status(200).json({
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
        account: result.account,
      });
    } catch (error) {
      next(error);
    }
  };

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as PortalRequestPasswordResetRequestBody;
      const result = await this.deps.requestPasswordResetUseCase.execute(body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  confirmPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as PortalConfirmPasswordResetRequestBody;
      await this.deps.confirmPasswordResetUseCase.execute(body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /** The frontend's own session bootstrap ("am I logged in, and as who") - also used by the
   * dashboard to show contactNumber/borrowerId without a second round trip. */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const result = await this.deps.getPortalAccountUseCase.execute(account.sub);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
