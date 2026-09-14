import type { NextFunction, Request, Response } from 'express';
import type { SearchLicensedRecruitmentAgenciesUseCase } from '../../application/use-cases/SearchLicensedRecruitmentAgenciesUseCase';
import { presentLicensedRecruitmentAgency } from './presenters/LicensedRecruitmentAgencyPresenter';

export interface LicensedRecruitmentAgencyControllerDeps {
  searchLicensedRecruitmentAgenciesUseCase: SearchLicensedRecruitmentAgenciesUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class LicensedRecruitmentAgencyController {
  constructor(private readonly deps: LicensedRecruitmentAgencyControllerDeps) {}

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const entries = await this.deps.searchLicensedRecruitmentAgenciesUseCase.execute(q);
      res.status(200).json({ items: entries.map(presentLicensedRecruitmentAgency) });
    } catch (error) {
      next(error);
    }
  };
}
