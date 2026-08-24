import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { resolveBranchScope, resolveBranchFilter } from '@shared/http/branchScope';
import { ValidationError } from '@shared/errors/DomainError';
import type { CreateBulkExportJobUseCase } from '../../application/use-cases/CreateBulkExportJobUseCase';
import type { ListMyBulkExportJobsUseCase } from '../../application/use-cases/ListMyBulkExportJobsUseCase';
import type { DownloadBulkExportJobUseCase } from '../../application/use-cases/DownloadBulkExportJobUseCase';
import type { GetBulkExportDefaultRangeUseCase } from '../../application/use-cases/GetBulkExportDefaultRangeUseCase';
import { bulkExportTypeSchema, type CreateBulkExportJobRequestBody } from './bulkExportSchemas';
import { presentBulkExportJob } from './presenters/BulkExportJobPresenter';

export interface BulkExportControllerDeps {
  createBulkExportJobUseCase: CreateBulkExportJobUseCase;
  listMyBulkExportJobsUseCase: ListMyBulkExportJobsUseCase;
  downloadBulkExportJobUseCase: DownloadBulkExportJobUseCase;
  getBulkExportDefaultRangeUseCase: GetBulkExportDefaultRangeUseCase;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture). */
export class BulkExportController {
  constructor(private readonly deps: BulkExportControllerDeps) {}

  defaultRange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const exportType = bulkExportTypeSchema.parse(req.query.exportType);
      const range = await this.deps.getBulkExportDefaultRangeUseCase.execute(exportType);
      res.status(200).json({ startDate: range.startDate.toISOString(), endDate: range.endDate.toISOString() });
    } catch {
      next(new ValidationError('exportType query parameter must be BORROWER_ATTACHMENTS or LOAN_ACCOUNT_ATTACHMENTS.'));
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const scope = resolveBranchScope(req);
      const body = req.body as CreateBulkExportJobRequestBody;
      const job = await this.deps.createBulkExportJobUseCase.execute({
        requestedByUserId: currentUser.sub,
        branchId: resolveBranchFilter(scope),
        exportType: body.exportType,
        startDate: body.startDate,
        endDate: body.endDate,
      });
      res.status(201).json(presentBulkExportJob(job));
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const jobs = await this.deps.listMyBulkExportJobsUseCase.execute(currentUser.sub);
      res.status(200).json({ items: jobs.map(presentBulkExportJob) });
    } catch (error) {
      next(error);
    }
  };

  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const { fileName, fileSize, stream } = await this.deps.downloadBulkExportJobUseCase.execute(req.params.id as string, currentUser.sub);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(fileSize));
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      stream.on('error', (error) => next(error));
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  };
}
