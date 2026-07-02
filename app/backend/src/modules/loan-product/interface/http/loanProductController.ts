import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import type { CreateLoanProductUseCase } from '../../application/use-cases/CreateLoanProductUseCase';
import type { GetLoanProductUseCase } from '../../application/use-cases/GetLoanProductUseCase';
import type { ListLoanProductsUseCase } from '../../application/use-cases/ListLoanProductsUseCase';
import type { CreateLoanProductVersionUseCase } from '../../application/use-cases/CreateLoanProductVersionUseCase';
import type { ActivateLoanProductVersionUseCase } from '../../application/use-cases/ActivateLoanProductVersionUseCase';
import type { CreateLoanProductRequestBody, CreateLoanProductVersionRequestBody } from './loanProductSchemas';
import { presentLoanProduct } from './presenters/LoanProductPresenter';

export interface LoanProductControllerDeps {
  createLoanProductUseCase: CreateLoanProductUseCase;
  getLoanProductUseCase: GetLoanProductUseCase;
  listLoanProductsUseCase: ListLoanProductsUseCase;
  createLoanProductVersionUseCase: CreateLoanProductVersionUseCase;
  activateLoanProductVersionUseCase: ActivateLoanProductVersionUseCase;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture), matching AuthController's shape. */
export class LoanProductController {
  constructor(private readonly deps: LoanProductControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateLoanProductRequestBody;
      const product = await this.deps.createLoanProductUseCase.execute(body);
      res.status(201).json(presentLoanProduct(product));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.deps.getLoanProductUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanProduct(product));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, cursor } = parsePaginationParams(req.query);
      const products = await this.deps.listLoanProductsUseCase.execute({ limit, cursor });
      res.status(200).json(toPaginatedResponse(products.map(presentLoanProduct), limit, (item) => item.id));
    } catch (error) {
      next(error);
    }
  };

  createVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateLoanProductVersionRequestBody;
      await this.deps.createLoanProductVersionUseCase.execute({ ...body, loanProductId: req.params.id as string });
      // Return the whole product graph (including the new version) rather
      // than just the version, so clients don't need a second round-trip.
      const product = await this.deps.getLoanProductUseCase.execute(req.params.id as string);
      res.status(201).json(presentLoanProduct(product));
    } catch (error) {
      next(error);
    }
  };

  activateVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deps.activateLoanProductVersionUseCase.execute(req.params.id as string, req.params.versionId as string);
      const product = await this.deps.getLoanProductUseCase.execute(req.params.id as string);
      res.status(200).json(presentLoanProduct(product));
    } catch (error) {
      next(error);
    }
  };
}
