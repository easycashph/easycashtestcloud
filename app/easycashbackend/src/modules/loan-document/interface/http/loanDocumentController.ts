import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { resolveBranchScope, assertBranchAccess } from '@shared/http/branchScope';
import { withIdempotency } from '@shared/http/idempotency';
import { NotFoundError } from '@shared/errors/DomainError';
import { streamZipResponse } from '@shared/http/streamZipResponse';
import type { IIdempotencyKeyStore } from '@shared/application/ports/IIdempotencyKeyStore';
import type { GetLoanAccountUseCase } from '@modules/loan-account/application/use-cases/GetLoanAccountUseCase';
import type { GenerateLoanDocumentUseCase } from '../../application/use-cases/GenerateLoanDocumentUseCase';
import type { ListLoanDocumentsUseCase } from '../../application/use-cases/ListLoanDocumentsUseCase';
import type { GetGeneratedLoanDocumentFileUseCase } from '../../application/use-cases/GetGeneratedLoanDocumentFileUseCase';
import type { DownloadAllLoanAccountDocumentsUseCase } from '../../application/use-cases/DownloadAllLoanAccountDocumentsUseCase';
import type { GenerateLoanDocumentRequestBody } from './loanDocumentSchemas';
import { presentGeneratedLoanDocument, presentLoanDocumentListItem } from './presenters/LoanDocumentPresenter';

export interface LoanDocumentControllerDeps {
  generateLoanDocumentUseCase: GenerateLoanDocumentUseCase;
  listLoanDocumentsUseCase: ListLoanDocumentsUseCase;
  getGeneratedLoanDocumentFileUseCase: GetGeneratedLoanDocumentFileUseCase;
  downloadAllLoanAccountDocumentsUseCase: DownloadAllLoanAccountDocumentsUseCase;
  getLoanAccountUseCase: GetLoanAccountUseCase;
  idempotencyKeyStore: IIdempotencyKeyStore;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture). */
export class LoanDocumentController {
  constructor(private readonly deps: LoanDocumentControllerDeps) {}

  generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const endpoint = 'POST /loan-accounts/:id/documents';
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const body = req.body as GenerateLoanDocumentRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource write.

      await withIdempotency(this.deps.idempotencyKeyStore, req, res, endpoint, currentUser.sub, async () => {
        const document = await this.deps.generateLoanDocumentUseCase.execute(
          req.params.id as string,
          body.documentTemplateCode,
          currentUser.sub,
        );
        return { statusCode: 201, body: presentGeneratedLoanDocument(document) };
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource read.

      const items = await this.deps.listLoanDocumentsUseCase.execute(req.params.id as string);
      res.status(200).json({ items: items.map(presentLoanDocumentListItem) });
    } catch (error) {
      next(error);
    }
  };

  download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource read.

      const file = await this.deps.getGeneratedLoanDocumentFileUseCase.execute(req.params.generatedDocumentId as string);
      // Guards against a mismatched (loanAccountId, generatedDocumentId) pair bypassing the branch
      // check above by pointing the URL's :id at a loan account the caller has access to while the
      // actual document belongs to a different (possibly different-branch) loan account.
      if (file.loanAccountId !== req.params.id) {
        throw new NotFoundError('GeneratedLoanDocument', req.params.generatedDocumentId as string);
      }
      res.setHeader('Content-Type', 'application/pdf');
      // No filename= here (2026-07-22) - the frontend always fetches this as a blob and forces the
      // save via a synthetic `<a download>` link (see apiClient.ts's downloadFile), so the actual
      // saved name comes from there (buildDocumentFileName's `{LoanCode}_{DocumentName}.pdf`
      // convention), not this raw internal storage filename.
      res.setHeader('Content-Disposition', 'attachment');
      res.status(200).send(file.buffer);
    } catch (error) {
      next(error);
    }
  };

  downloadAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource read.

      const { zipFileName, entries } = await this.deps.downloadAllLoanAccountDocumentsUseCase.execute(req.params.id as string);
      streamZipResponse(res, zipFileName, entries);
    } catch (error) {
      next(error);
    }
  };
}
