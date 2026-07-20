import type { Request, Response, NextFunction } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListProductTypeLabelsUseCase } from '../../application/use-cases/ListProductTypeLabelsUseCase';
import type { UpdateProductTypeLabelUseCase } from '../../application/use-cases/UpdateProductTypeLabelUseCase';
import { presentProductTypeLabel } from './presenters/ProductTypeLabelPresenter';

export interface ProductTypeLabelControllerDeps {
  listProductTypeLabelsUseCase: ListProductTypeLabelsUseCase;
  updateProductTypeLabelUseCase: UpdateProductTypeLabelUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture). */
export class ProductTypeLabelController {
  constructor(private readonly deps: ProductTypeLabelControllerDeps) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const productTypeLabels = await this.deps.listProductTypeLabelsUseCase.execute();
      res.status(200).json({ productTypeLabels: productTypeLabels.map(presentProductTypeLabel) });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { label: string };
      const currentUser = getCurrentUser(req);
      const productTypeLabel = await this.deps.updateProductTypeLabelUseCase.execute(req.params.id as string, body.label, currentUser.sub);
      res.status(200).json(presentProductTypeLabel(productTypeLabel));
    } catch (error) {
      next(error);
    }
  };
}
