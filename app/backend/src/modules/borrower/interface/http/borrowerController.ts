import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import type { CreateBorrowerUseCase } from '../../application/use-cases/CreateBorrowerUseCase';
import type { GetBorrowerUseCase } from '../../application/use-cases/GetBorrowerUseCase';
import type { ListBorrowersUseCase } from '../../application/use-cases/ListBorrowersUseCase';
import type { CreateCoBorrowerUseCase } from '../../application/use-cases/CreateCoBorrowerUseCase';
import type { GetCoBorrowerUseCase } from '../../application/use-cases/GetCoBorrowerUseCase';
import type { CreateBorrowerRequestBody, CreateCoBorrowerRequestBody } from './borrowerSchemas';
import { presentBorrower, presentCoBorrower } from './presenters/BorrowerPresenter';

export interface BorrowerControllerDeps {
  createBorrowerUseCase: CreateBorrowerUseCase;
  getBorrowerUseCase: GetBorrowerUseCase;
  listBorrowersUseCase: ListBorrowersUseCase;
  createCoBorrowerUseCase: CreateCoBorrowerUseCase;
  getCoBorrowerUseCase: GetCoBorrowerUseCase;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture), matching AuthController's shape. */
export class BorrowerController {
  constructor(private readonly deps: BorrowerControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateBorrowerRequestBody;
      const borrower = await this.deps.createBorrowerUseCase.execute(body);
      res.status(201).json(presentBorrower(borrower));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const borrower = await this.deps.getBorrowerUseCase.execute(req.params.id as string);
      res.status(200).json(presentBorrower(borrower));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePaginationParams(req.query);
      const borrowers = await this.deps.listBorrowersUseCase.execute({ limit, cursor });
      res.status(200).json(toPaginatedResponse(borrowers.map(presentBorrower), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  createCoBorrower = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateCoBorrowerRequestBody;
      const coBorrower = await this.deps.createCoBorrowerUseCase.execute(body);
      res.status(201).json(presentCoBorrower(coBorrower));
    } catch (error) {
      next(error);
    }
  };

  getCoBorrower = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coBorrower = await this.deps.getCoBorrowerUseCase.execute(req.params.id as string);
      res.status(200).json(presentCoBorrower(coBorrower));
    } catch (error) {
      next(error);
    }
  };
}
