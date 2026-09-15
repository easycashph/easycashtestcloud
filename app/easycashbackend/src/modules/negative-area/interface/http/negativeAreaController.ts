import type { NextFunction, Request, Response } from 'express';
import type { ListNegativeAreasUseCase } from '../../application/use-cases/ListNegativeAreasUseCase';
import type { CreateNegativeAreaUseCase } from '../../application/use-cases/CreateNegativeAreaUseCase';
import type { DeleteNegativeAreaUseCase } from '../../application/use-cases/DeleteNegativeAreaUseCase';
import type { CreateNegativeAreaRequestBody } from './negativeAreaSchemas';
import { presentNegativeArea } from './presenters/NegativeAreaPresenter';

export interface NegativeAreaControllerDeps {
  listNegativeAreasUseCase: ListNegativeAreasUseCase;
  createNegativeAreaUseCase: CreateNegativeAreaUseCase;
  deleteNegativeAreaUseCase: DeleteNegativeAreaUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture). */
export class NegativeAreaController {
  constructor(private readonly deps: NegativeAreaControllerDeps) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entries = await this.deps.listNegativeAreasUseCase.execute();
      res.status(200).json({ items: entries.map(presentNegativeArea) });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateNegativeAreaRequestBody;
      const entry = await this.deps.createNegativeAreaUseCase.execute(body);
      res.status(201).json(presentNegativeArea(entry));
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deps.deleteNegativeAreaUseCase.execute(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
