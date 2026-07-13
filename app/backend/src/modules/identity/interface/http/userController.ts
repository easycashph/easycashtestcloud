import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, parseSearchParam, toPaginatedResponse } from '@shared/http/pagination';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase';
import type { CreateUserUseCase } from '../../application/use-cases/CreateUserUseCase';
import type { UpdateUserUseCase } from '../../application/use-cases/UpdateUserUseCase';
import type { CreateUserRequestBody, UpdateUserRequestBody } from './userSchemas';
import { presentUser } from './presenters/UserPresenter';

export interface UserControllerDeps {
  listUsersUseCase: ListUsersUseCase;
  createUserUseCase: CreateUserUseCase;
  updateUserUseCase: UpdateUserUseCase;
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
}
