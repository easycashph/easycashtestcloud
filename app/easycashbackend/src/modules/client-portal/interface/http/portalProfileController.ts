import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import type { GetPortalProfileUseCase } from '../../application/use-cases/GetPortalProfileUseCase';
import type { UpdatePortalProfileUseCase } from '../../application/use-cases/UpdatePortalProfileUseCase';
import type { GetPortalAssignedLoanOfficerUseCase } from '../../application/use-cases/GetPortalAssignedLoanOfficerUseCase';
import type { UploadPortalProfilePhotoUseCase } from '../../application/use-cases/UploadPortalProfilePhotoUseCase';
import type { DownloadPortalProfilePhotoUseCase } from '../../application/use-cases/DownloadPortalProfilePhotoUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import type { UpdatePortalProfileRequestBody } from './portalProfileSchemas';

export interface PortalProfileControllerDeps {
  getPortalProfileUseCase: GetPortalProfileUseCase;
  updatePortalProfileUseCase: UpdatePortalProfileUseCase;
  getPortalAssignedLoanOfficerUseCase: GetPortalAssignedLoanOfficerUseCase;
  uploadPortalProfilePhotoUseCase: UploadPortalProfilePhotoUseCase;
  downloadPortalProfilePhotoUseCase: DownloadPortalProfilePhotoUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), mirrors every other
 * portal controller's shape. Both use cases now return a ready-to-serialize PortalProfileDto
 * directly (2026-07-30) - see GetPortalProfileUseCase's own doc comment for why the presentation
 * mapping moved into the application layer. */
export class PortalProfileController {
  constructor(private readonly deps: PortalProfileControllerDeps) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const profile = await this.deps.getPortalProfileUseCase.execute(account.sub);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as UpdatePortalProfileRequestBody;
      const profile = await this.deps.updatePortalProfileUseCase.execute(account.sub, body);
      res.status(200).json(profile);
    } catch (error) {
      next(error);
    }
  };

  loanOfficer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const loanOfficer = await this.deps.getPortalAssignedLoanOfficerUseCase.execute(account.sub);
      res.status(200).json(loanOfficer);
    } catch (error) {
      next(error);
    }
  };

  uploadPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('No file was uploaded (expected multipart field "file").');
      }
      const account = getCurrentPortalAccount(req);
      const attachment = await this.deps.uploadPortalProfilePhotoUseCase.execute({
        portalAccountId: account.sub,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        data: req.file.buffer,
      });
      res.status(201).json({ id: attachment.id, fileName: attachment.fileName });
    } catch (error) {
      next(error);
    }
  };

  downloadPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const result = await this.deps.downloadPortalProfilePhotoUseCase.execute(account.sub);
      if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No profile photo has been uploaded yet.' } });
        return;
      }
      res.setHeader('Content-Type', result.record.fileType);
      res.status(200).send(result.data);
    } catch (error) {
      next(error);
    }
  };
}
