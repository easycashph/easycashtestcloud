import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import type { ListPsgcOptionsUseCase } from '../../application/use-cases/ListPsgcOptionsUseCase';

export interface PsgcControllerDeps {
  listPsgcOptionsUseCase: ListPsgcOptionsUseCase;
}

function requireQueryParam(req: Request, name: string): string {
  const value = req.query[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`Query param "${name}" is required.`);
  }
  return value;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class PsgcController {
  constructor(private readonly deps: PsgcControllerDeps) {}

  listRegions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ items: await this.deps.listPsgcOptionsUseCase.listRegions() });
    } catch (error) {
      next(error);
    }
  };

  listProvinces = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const regionCode = requireQueryParam(req, 'regionCode');
      res.status(200).json({ items: await this.deps.listPsgcOptionsUseCase.listProvinces(regionCode) });
    } catch (error) {
      next(error);
    }
  };

  listCities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provinceCode = requireQueryParam(req, 'provinceCode');
      res.status(200).json({ items: await this.deps.listPsgcOptionsUseCase.listCities(provinceCode) });
    } catch (error) {
      next(error);
    }
  };

  listBarangays = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cityMunicipalityCode = requireQueryParam(req, 'cityMunicipalityCode');
      res.status(200).json({ items: await this.deps.listPsgcOptionsUseCase.listBarangays(cityMunicipalityCode) });
    } catch (error) {
      next(error);
    }
  };
}
