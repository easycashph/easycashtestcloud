import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { LoginUseCase } from '@modules/identity/application/use-cases/LoginUseCase';
import type { RefreshTokenUseCase } from '@modules/identity/application/use-cases/RefreshTokenUseCase';
import type { LogoutUseCase } from '@modules/identity/application/use-cases/LogoutUseCase';
import type { LogoutAllUseCase } from '@modules/identity/application/use-cases/LogoutAllUseCase';
import type { GetCurrentUserUseCase } from '@modules/identity/application/use-cases/GetCurrentUserUseCase';
import type { ListSessionsUseCase } from '@modules/identity/application/use-cases/ListSessionsUseCase';
import type { RevokeSessionUseCase } from '@modules/identity/application/use-cases/RevokeSessionUseCase';
import type { VerifyLoginOtpUseCase } from '@modules/identity/application/use-cases/VerifyLoginOtpUseCase';
import type { RequestPasswordResetUseCase } from '@modules/identity/application/use-cases/RequestPasswordResetUseCase';
import type { ConfirmPasswordResetUseCase } from '@modules/identity/application/use-cases/ConfirmPasswordResetUseCase';
import type {
  LoginRequestBody,
  VerifyLoginOtpRequestBody,
  RequestPasswordResetRequestBody,
  ConfirmPasswordResetRequestBody,
} from './authSchemas';
import { clearRefreshTokenCookie, readRefreshTokenCookie, setRefreshTokenCookie } from './cookies';
import { TokenNotFoundError, TokenExpiredError } from '@modules/identity/application/errors/AuthErrors';

export interface AuthControllerDeps {
  loginUseCase: LoginUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  logoutUseCase: LogoutUseCase;
  logoutAllUseCase: LogoutAllUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
  listSessionsUseCase: ListSessionsUseCase;
  revokeSessionUseCase: RevokeSessionUseCase;
  verifyLoginOtpUseCase: VerifyLoginOtpUseCase;
  requestPasswordResetUseCase: RequestPasswordResetUseCase;
  confirmPasswordResetUseCase: ConfirmPasswordResetUseCase;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture). */
export class AuthController {
  constructor(private readonly deps: AuthControllerDeps) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body as LoginRequestBody;
      const result = await this.deps.loginUseCase.execute({
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
      });

      // 2026-07-22 (Two-Factor Authentication) - LoginUseCase's other possible result: no cookie,
      // no tokens yet, just enough for the frontend to show the OTP entry step.
      if ('twoFactorRequired' in result) {
        res.status(200).json({ twoFactorRequired: true, challengeId: result.challengeId, channel: result.channel });
        return;
      }

      setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
      res.status(200).json({
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  /** Settings > Security > Two-Factor Authentication (2026-07-22) - completes a login LoginUseCase
   * paused on `twoFactorRequired`. Same response shape as a normal `login` success. */
  verifyLoginOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { challengeId, code } = req.body as VerifyLoginOtpRequestBody;
      const result = await this.deps.verifyLoginOtpUseCase.execute({
        challengeId,
        code,
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
      });

      setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
      res.status(200).json({
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  /** Forgot Password (2026-07-28). Always 200 with a challengeId, whether or not the email matched
   * an active user - see RequestPasswordResetUseCase's doc comment. */
  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body as RequestPasswordResetRequestBody;
      const result = await this.deps.requestPasswordResetUseCase.execute({ email });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /** Forgot Password (2026-07-28). Deliberately does not log the user in - see
   * ConfirmPasswordResetUseCase's doc comment. */
  confirmPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { challengeId, code, newPassword } = req.body as ConfirmPasswordResetRequestBody;
      await this.deps.confirmPasswordResetUseCase.execute({ challengeId, code, newPassword });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken = readRefreshTokenCookie(req);
      if (!rawRefreshToken) {
        throw new TokenNotFoundError();
      }

      const result = await this.deps.refreshTokenUseCase.execute({
        rawRefreshToken,
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
      });

      setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
      res.status(200).json({
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
      });
    } catch (error) {
      // A reused/expired/invalid refresh token always clears the cookie
      // client-side too, so the browser stops presenting a dead token.
      if (error instanceof TokenNotFoundError || error instanceof TokenExpiredError) {
        clearRefreshTokenCookie(res);
      }
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawRefreshToken = readRefreshTokenCookie(req);
      await this.deps.logoutUseCase.execute({ rawRefreshToken });
      clearRefreshTokenCookie(res);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const result = await this.deps.logoutAllUseCase.execute({ userId: currentUser.sub });
      clearRefreshTokenCookie(res);
      res.status(200).json({ revokedCount: result.revokedCount });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const result = await this.deps.getCurrentUserUseCase.execute({ userId: currentUser.sub });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  listSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const items = await this.deps.listSessionsUseCase.execute({ userId: currentUser.sub, currentSessionId: currentUser.sid });
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      await this.deps.revokeSessionUseCase.execute({ userId: currentUser.sub, sessionId: req.params.id! });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
