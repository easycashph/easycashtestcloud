import type { Request, Response, NextFunction } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListRolesAndPermissionsUseCase } from '../../application/use-cases/ListRolesAndPermissionsUseCase';
import type { UpdateRolePermissionsUseCase } from '../../application/use-cases/UpdateRolePermissionsUseCase';
import { presentPermission, presentRoleWithPermissions } from './presenters/AccessControlPresenter';
import type { updateRolePermissionsSchema } from './accessControlSchemas';
import type { z } from 'zod';

export interface AccessControlControllerDeps {
  listRolesAndPermissionsUseCase: ListRolesAndPermissionsUseCase;
  updateRolePermissionsUseCase: UpdateRolePermissionsUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class AccessControlController {
  constructor(private readonly deps: AccessControlControllerDeps) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { permissions, roles } = await this.deps.listRolesAndPermissionsUseCase.execute();
      res.status(200).json({ permissions: permissions.map(presentPermission), roles: roles.map(presentRoleWithPermissions) });
    } catch (error) {
      next(error);
    }
  };

  updateRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { permissionCodes } = req.body as z.infer<typeof updateRolePermissionsSchema>;
      const currentUser = getCurrentUser(req);
      const role = await this.deps.updateRolePermissionsUseCase.execute({
        roleId: req.params.roleId as string,
        permissionCodes,
        updatedByUserId: currentUser.sub,
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
      });
      res.status(200).json(presentRoleWithPermissions(role));
    } catch (error) {
      next(error);
    }
  };
}
