import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateManualMisPostUseCase } from '../../application/use-cases/CreateManualMisPostUseCase';
import type { WithdrawManualMisPostUseCase } from '../../application/use-cases/WithdrawManualMisPostUseCase';
import type { ListMisPostsForAdminUseCase } from '../../application/use-cases/ListMisPostsForAdminUseCase';
import { presentMisPost } from './presenters/MisPostPresenter';

export interface MisPostControllerDeps {
  createManualMisPostUseCase: CreateManualMisPostUseCase;
  withdrawManualMisPostUseCase: WithdrawManualMisPostUseCase;
  listMisPostsForAdminUseCase: ListMisPostsForAdminUseCase;
}

/** MIS-only admin surface (gated by `system_announcement.manage` in the router - same "si MIS ang
 * mag popost" permission as the existing announcement popup, reused rather than adding a
 * near-duplicate permission key). */
export class MisPostController {
  constructor(private readonly deps: MisPostControllerDeps) {}

  createManual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      if (!req.file) {
        throw new ValidationError('An image is required.');
      }
      const caption = typeof req.body?.caption === 'string' ? req.body.caption : '';
      const durationMinutes = Number(req.body?.durationMinutes);
      const post = await this.deps.createManualMisPostUseCase.execute({
        caption,
        durationMinutes,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        data: req.file.buffer,
        createdByUserId: currentUser.sub,
      });
      res.status(201).json(presentMisPost(post));
    } catch (error) {
      next(error);
    }
  };

  withdraw = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deps.withdrawManualMisPostUseCase.execute(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const posts = await this.deps.listMisPostsForAdminUseCase.execute();
      res.status(200).json(posts.map(presentMisPost));
    } catch (error) {
      next(error);
    }
  };
}
