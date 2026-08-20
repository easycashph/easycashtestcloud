import type { NextFunction, Request, Response } from 'express';
import type { GetActivePortalPostsUseCase } from '../../application/use-cases/GetActivePortalPostsUseCase';
import type { GetMisPostImageUseCase } from '../../application/use-cases/GetMisPostImageUseCase';
import { presentMisPost } from './presenters/MisPostPresenter';

export interface PublicMisPostControllerDeps {
  getActivePortalPostsUseCase: GetActivePortalPostsUseCase;
  getMisPostImageUseCase: GetMisPostImageUseCase;
}

export class PublicMisPostController {
  constructor(private readonly deps: PublicMisPostControllerDeps) {}

  getActive = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { autoPost, manualPosts } = await this.deps.getActivePortalPostsUseCase.execute();
      res.status(200).json({
        autoPost: autoPost ? presentMisPost(autoPost) : null,
        manualPosts: manualPosts.map(presentMisPost),
      });
    } catch (error) {
      next(error);
    }
  };

  getImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const image = await this.deps.getMisPostImageUseCase.execute(req.params.id as string);
      res.setHeader('Content-Type', image.fileType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      // Helmet's default same-origin CORP would otherwise block the Portal (a different origin/
      // port) from rendering this in an <img> tag - safe to relax here since this image is
      // already served with no auth check at all (public marketing/advisory material).
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.status(200).send(image.data);
    } catch (error) {
      next(error);
    }
  };
}
