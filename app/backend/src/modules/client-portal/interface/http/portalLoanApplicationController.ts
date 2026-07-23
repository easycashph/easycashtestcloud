import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import type { SubmitLoanApplicationUseCase } from '../../application/use-cases/SubmitLoanApplicationUseCase';
import type { ListPortalLoanApplicationsUseCase } from '../../application/use-cases/ListPortalLoanApplicationsUseCase';
import type { ListPortalBranchesUseCase } from '../../application/use-cases/ListPortalBranchesUseCase';
import type { UploadPortalLoanApplicationDocumentUseCase } from '../../application/use-cases/UploadPortalLoanApplicationDocumentUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type { SubmitLoanApplicationRequestBody, UploadPortalLoanApplicationDocumentRequestBody } from './portalLoanApplicationSchemas';
import { uploadPortalLoanApplicationDocumentSchema } from './portalLoanApplicationSchemas';

export interface PortalLoanApplicationControllerDeps {
  submitLoanApplicationUseCase: SubmitLoanApplicationUseCase;
  listPortalLoanApplicationsUseCase: ListPortalLoanApplicationsUseCase;
  listPortalBranchesUseCase: ListPortalBranchesUseCase;
  uploadPortalLoanApplicationDocumentUseCase: UploadPortalLoanApplicationDocumentUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class PortalLoanApplicationController {
  constructor(private readonly deps: PortalLoanApplicationControllerDeps) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as SubmitLoanApplicationRequestBody;
      const application = await this.deps.submitLoanApplicationUseCase.execute(account.sub, body);
      const props = application.toProps();
      res.status(201).json({
        id: props.id,
        branchId: props.branchId,
        status: props.status,
        requestedCategory: props.requestedCategory,
        requestedAmount: props.requestedAmount,
        requestedTermMonths: props.requestedTermMonths,
        createdAt: props.createdAt,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const applications = await this.deps.listPortalLoanApplicationsUseCase.execute(account.sub);
      res.status(200).json(applications);
    } catch (error) {
      next(error);
    }
  };

  listBranches = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const branches = await this.deps.listPortalBranchesUseCase.execute();
      res.status(200).json(branches);
    } catch (error) {
      next(error);
    }
  };

  uploadDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('No file was uploaded (expected multipart field "file").');
      }
      const account = getCurrentPortalAccount(req);
      const body = uploadPortalLoanApplicationDocumentSchema.parse(req.body) as UploadPortalLoanApplicationDocumentRequestBody;
      const attachment = await this.deps.uploadPortalLoanApplicationDocumentUseCase.execute({
        portalAccountId: account.sub,
        loanApplicationId: req.params.id as string,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        data: req.file.buffer,
        documentCategory: body.documentCategory ?? null,
      });
      res.status(201).json({ id: attachment.id, fileName: attachment.fileName, documentCategory: attachment.documentCategory });
    } catch (error) {
      next(error);
    }
  };
}
