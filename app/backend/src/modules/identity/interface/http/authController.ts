import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { LoginUseCase } from '@modules/identity/application/use-cases/LoginUseCase';
import type { RefreshTokenUseCase } from '@modules/identity/application/use-cases/RefreshTokenUseCase';
import type { LogoutUseCase } from '@modules/identity/application/use-cases/LogoutUseCase';
import type { LogoutAllUseCase } from '@modules/identity/application/use-cases/LogoutAllUseCase';
import type { GetCurrentUserUseCase } from '@modules/identity/application/use-cases/GetCurrentUserUseCase';
import type { ListSessionsUseCase } from '@modules/identity/application/use-cases/ListSessionsUseCase';
import type { RevokeSessionUseCase } from '@modules/identity/application/use-cases/RevokeSessionUseCase';
import type { LoginRequestBody } from './authSchemas';
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
