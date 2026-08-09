import type { NextFunction, Request, Response } from 'express';
import type { ListDocumentTemplatesForAdminUseCase } from '../../application/use-cases/ListDocumentTemplatesForAdminUseCase';
import type { UpdateDocumentTemplateRequiredUseCase } from '../../application/use-cases/UpdateDocumentTemplateRequiredUseCase';
import type { SetDocumentTemplateProductMappingsUseCase } from '../../application/use-cases/SetDocumentTemplateProductMappingsUseCase';
import type { UpdateDocumentTemplateRequiredRequestBody, SetDocumentTemplateProductMappingsRequestBody } from './documentTemplateAdminSchemas';
import { presentDocumentTemplateAdminResult } from './presenters/DocumentTemplateAdminPresenter';

export interface DocumentTemplateAdminControllerDeps {
  listDocumentTemplatesForAdminUseCase: ListDocumentTemplatesForAdminUseCase;
  updateDocumentTemplateRequiredUseCase: UpdateDocumentTemplateRequiredUseCase;
  setDocumentTemplateProductMappingsUseCase: SetDocumentTemplateProductMappingsUseCase;
}

/** 2026-08-09 (Document Templates admin config, user request): thin controllers only — no business logic here (CLAUDE.md §Architecture). */
export class DocumentTemplateAdminController {
  constructor(private readonly deps: DocumentTemplateAdminControllerDeps) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.deps.listDocumentTemplatesForAdminUseCase.execute();
      res.status(200).json(presentDocumentTemplateAdminResult(result));
    } catch (error) {
      next(error);
    }
  };

  updateRequired = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateDocumentTemplateRequiredRequestBody;
      await this.deps.updateDocumentTemplateRequiredUseCase.execute(req.params.id as string, body.isRequired);
      const result = await this.deps.listDocumentTemplatesForAdminUseCase.execute();
      res.status(200).json(presentDocumentTemplateAdminResult(result));
    } catch (error) {
      next(error);
    }
  };

  setProductMappings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as SetDocumentTemplateProductMappingsRequestBody;
      await this.deps.setDocumentTemplateProductMappingsUseCase.execute(req.params.id as string, body.loanProductIds);
      const result = await this.deps.listDocumentTemplatesForAdminUseCase.execute();
      res.status(200).json(presentDocumentTemplateAdminResult(result));
    } catch (error) {
      next(error);
    }
  };
}
