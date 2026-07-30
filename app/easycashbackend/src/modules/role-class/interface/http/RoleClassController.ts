import type { Request, Response, NextFunction } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListRoleClassesUseCase } from '../../application/use-cases/ListRoleClassesUseCase';
import type { CreateRoleClassUseCase } from '../../application/use-cases/CreateRoleClassUseCase';
import type { UpdateRoleClassUseCase } from '../../application/use-cases/UpdateRoleClassUseCase';
import type { DeleteRoleClassUseCase } from '../../application/use-cases/DeleteRoleClassUseCase';
import { presentRoleClass } from './presenters/RoleClassPresenter';

export interface RoleClassControllerDeps {
  listRoleClassesUseCase: ListRoleClassesUseCase;
  createRoleClassUseCase: CreateRoleClassUseCase;
  updateRoleClassUseCase: UpdateRoleClassUseCase;
  deleteRoleClassUseCase: DeleteRoleClassUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class RoleClassController {
  constructor(private readonly deps: RoleClassControllerDeps) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roleTypes, roleClasses } = await this.deps.listRoleClassesUseCase.execute();
      res.status(200).json({ roleTypes, roleClasses: roleClasses.map(presentRoleClass) });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { roleId: string; name: string };
      const currentUser = getCurrentUser(req);
      const roleClass = await this.deps.createRoleClassUseCase.execute(body, currentUser.sub);
      res.status(201).json(presentRoleClass(roleClass));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { name?: string; roleId?: string };
      const currentUser = getCurrentUser(req);
      const roleClass = await this.deps.updateRoleClassUseCase.execute(req.params.id as string, body, currentUser.sub);
      res.status(200).json(presentRoleClass(roleClass));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      await this.deps.deleteRoleClassUseCase.execute(req.params.id as string, currentUser.sub);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
