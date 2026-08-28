import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase';
import type { CreateUserUseCase } from '../../application/use-cases/CreateUserUseCase';
import type { UpdateUserUseCase } from '../../application/use-cases/UpdateUserUseCase';
import type { UpdateOwnProfileUseCase } from '../../application/use-cases/UpdateOwnProfileUseCase';
import type { ChangeOwnPasswordUseCase } from '../../application/use-cases/ChangeOwnPasswordUseCase';
import type { RequestTwoFactorSetupUseCase } from '../../application/use-cases/RequestTwoFactorSetupUseCase';
import type { ConfirmTwoFactorSetupUseCase } from '../../application/use-cases/ConfirmTwoFactorSetupUseCase';
import type { DisableTwoFactorUseCase } from '../../application/use-cases/DisableTwoFactorUseCase';
import type { ListSessionsUseCase } from '../../application/use-cases/ListSessionsUseCase';
import type { RevokeSessionUseCase } from '../../application/use-cases/RevokeSessionUseCase';
import type {
  ChangeOwnPasswordRequestBody,
  ConfirmTwoFactorSetupRequestBody,
  CreateUserRequestBody,
  DisableTwoFactorRequestBody,
  RequestTwoFactorSetupRequestBody,
  UpdateOwnProfileRequestBody,
  UpdateUserRequestBody,
} from './userSchemas';
import { presentUser } from './presenters/UserPresenter';

export interface UserControllerDeps {
  listUsersUseCase: ListUsersUseCase;
  createUserUseCase: CreateUserUseCase;
  updateUserUseCase: UpdateUserUseCase;
  updateOwnProfileUseCase: UpdateOwnProfileUseCase;
  changeOwnPasswordUseCase: ChangeOwnPasswordUseCase;
  requestTwoFactorSetupUseCase: RequestTwoFactorSetupUseCase;
  confirmTwoFactorSetupUseCase: ConfirmTwoFactorSetupUseCase;
  disableTwoFactorUseCase: DisableTwoFactorUseCase;
  /** 2026-08-28 (user request): Member Details > Active Sessions - lets anyone with `user.manage`
   * view and force sign-out ANY staff member's logged-in devices, not just their own. Reuses the
   * exact same use cases Settings > Security > Active Sessions already uses for self-service -
   * both are already scoped by `userId`, so the only difference here is which id the controller
   * passes in (the target member's, from the URL, instead of the caller's own). */
  listSessionsUseCase: ListSessionsUseCase;
  revokeSessionUseCase: RevokeSessionUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class UserController {
  constructor(private readonly deps: UserControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePaginationParams(req.query);
      const search = parseSearchParam(req.query);
      const users = await this.deps.listUsersUseCase.execute({ limit, cursor, search });
      res.status(200).json(toPaginatedResponse(users.map(presentUser), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateUserRequestBody;
      const currentUser = getCurrentUser(req);
      const user = await this.deps.createUserUseCase.execute(body, currentUser.sub);
      res.status(201).json(presentUser(user));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateUserRequestBody;
      const currentUser = getCurrentUser(req);
      const user = await this.deps.updateUserUseCase.execute(req.params.id as string, body, currentUser.sub);
      res.status(200).json(presentUser(user));
    } catch (error) {
      next(error);
    }
  };

  listSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // No `currentSessionId` to mark - this is the admin viewing SOMEONE ELSE's device list, not
      // their own, so no row should ever show "This device".
      const items = await this.deps.listSessionsUseCase.execute({ userId: req.params.id as string, currentSessionId: '' });
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deps.revokeSessionUseCase.execute({ userId: req.params.id as string, sessionId: req.params.sessionId as string });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  updateOwnProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateOwnProfileRequestBody;
      const currentUser = getCurrentUser(req);
      const user = await this.deps.updateOwnProfileUseCase.execute(currentUser.sub, body);
      res.status(200).json(presentUser(user));
    } catch (error) {
      next(error);
    }
  };

  changeOwnPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ChangeOwnPasswordRequestBody;
      const currentUser = getCurrentUser(req);
      await this.deps.changeOwnPasswordUseCase.execute(currentUser.sub, body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /** Settings > Security > Two-Factor Authentication (2026-07-22) - step 1: send a code. */
  requestTwoFactorSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as RequestTwoFactorSetupRequestBody;
      const currentUser = getCurrentUser(req);
      const result = await this.deps.requestTwoFactorSetupUseCase.execute({ userId: currentUser.sub, channel: body.channel });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /** Settings > Security > Two-Factor Authentication (2026-07-22) - step 2: confirm the code, turn 2FA on. */
  confirmTwoFactorSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as ConfirmTwoFactorSetupRequestBody;
      const currentUser = getCurrentUser(req);
      await this.deps.confirmTwoFactorSetupUseCase.execute({ userId: currentUser.sub, challengeId: body.challengeId, code: body.code });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /** Settings > Security > Two-Factor Authentication (2026-07-22) - the toggle-off escape hatch. */
  disableTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as DisableTwoFactorRequestBody;
      const currentUser = getCurrentUser(req);
      await this.deps.disableTwoFactorUseCase.execute({ userId: currentUser.sub, currentPassword: body.currentPassword });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
